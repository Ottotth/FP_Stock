import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import * as d3 from 'd3'
import { isNyMarketOpen } from './utils/marketHours'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

const INTERVAL_OPTIONS = [
  { value: '1m', label: '1M' },
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '30m', label: '30M' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1wk', label: '1WK' },
  { value: '1mo', label: '1MO' },
  { value: '3mo', label: '3MO' }
]

const RIGHT_OVERSCROLL_BARS = 30
const RIGHT_PRICE_AXIS_WIDTH = 30
const MIN_Y_SCALE_FACTOR = 0.35
const MAX_Y_SCALE_FACTOR = 4
const X_SCALE_DRAG_SENSITIVITY = 0.004
const CROSSHAIR_PRICE_LABEL_WIDTH = 62
const LAST_CANDLE_POLL_INTERVAL_MS = 3000

function getNyTradingDateKey(date) {
  if (!(date instanceof Date)) return null
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date)
  } catch (error) {
    return null
  }
}

function isSupportedInterval(interval) {
  return INTERVAL_OPTIONS.some((option) => option.value === interval)
}

function getStoredInterval(symbol) {
  if (!symbol) return '1d'
  try {
    const raw = localStorage.getItem(`candlestick_interval_${symbol}`)
    return isSupportedInterval(raw) ? raw : '1d'
  } catch (error) {
    return '1d'
  }
}

function setStoredInterval(symbol, interval) {
  if (!symbol || !isSupportedInterval(interval)) return
  try {
    localStorage.setItem(`candlestick_interval_${symbol}`, interval)
  } catch (error) {
    // ignore storage errors
  }
}

function parsePointDate(raw) {
  if (raw == null) return null

  if (Array.isArray(raw) && raw.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nano = 0] = raw
    const millis = Math.floor((Number(nano) || 0) / 1_000_000)
    // Backend LocalDateTime is stored in UTC semantics; parse as UTC then let browser render in local timezone.
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), millis))
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof raw === 'string') {
    const value = raw.trim()
    const hasTimezone = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(value)
    const normalized = hasTimezone ? value : `${value}Z`
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeCandlesPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.prices)) return payload.prices
  if (Array.isArray(payload.points)) return payload.points

  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp
  const quote = result?.indicators?.quote?.[0]
  const opens = quote?.open
  const highs = quote?.high
  const lows = quote?.low
  const closes = quote?.close

  if (Array.isArray(timestamps) && Array.isArray(opens) && Array.isArray(highs) && Array.isArray(lows) && Array.isArray(closes)) {
    const rows = []
    const count = Math.min(timestamps.length, opens.length, highs.length, lows.length, closes.length)
    for (let index = 0; index < count; index++) {
      rows.push({
        dateTime: new Date(Number(timestamps[index]) * 1000).toISOString(),
        open: opens[index],
        high: highs[index],
        low: lows[index],
        close: closes[index]
      })
    }
    return rows
  }

  return []
}

function normalizeLastCandlePayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const date = parsePointDate(
    payload.bucketStart
    ?? payload.bucket_start
    ?? payload.dateTime
    ?? payload.date_time
    ?? payload.datetime
    ?? payload.date
    ?? payload.time
  )
  if (!date) return null

  const open = Number(payload.open ?? payload.openPrice ?? payload.open_price)
  const high = Number(payload.high ?? payload.highPrice ?? payload.high_price)
  const low = Number(payload.low ?? payload.lowPrice ?? payload.low_price)
  const close = Number(payload.close ?? payload.closePrice ?? payload.close_price)

  if (![open, high, low, close].every(Number.isFinite)) return null
  return { date, open, high, low, close }
}

function mergeSeriesWithLastCandle(baseSeries, lastCandle) {
  if (!Array.isArray(baseSeries)) return lastCandle ? [lastCandle] : []
  if (!lastCandle) return baseSeries

  if (baseSeries.length === 0) return [lastCandle]

  const merged = [...baseSeries]
  const targetTime = lastCandle.date.getTime()
  const lastIndex = merged.length - 1
  const lastTime = merged[lastIndex]?.date?.getTime?.()

  if (Number.isFinite(lastTime) && lastTime === targetTime) {
    merged[lastIndex] = lastCandle
    return merged
  }

  const existingIndex = merged.findIndex((point) => point?.date?.getTime?.() === targetTime)
  if (existingIndex >= 0) {
    merged[existingIndex] = lastCandle
    return merged
  }

  if (!Number.isFinite(lastTime) || targetTime > lastTime) {
    merged.push(lastCandle)
    return merged
  }

  merged.push(lastCandle)
  merged.sort((left, right) => left.date.getTime() - right.date.getTime())
  return merged
}

export default function CandlestickView({ symbol, width, height, onBack }) {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  const [yPanOffset, setYPanOffset] = useState(0)
  const [yScaleFactor, setYScaleFactor] = useState(1)
  const [crosshair, setCrosshair] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragState, setDragState] = useState(null)
  const [selectedInterval, setSelectedInterval] = useState('1d')
  const [isIntervalMenuOpen, setIsIntervalMenuOpen] = useState(false)
  const intervalMenuRef = useRef(null)
  const clipPathId = useMemo(() => `candles-clip-${Math.random().toString(36).slice(2, 10)}`, [])

  const applyDefaultRange = (rows, interval) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      setVisibleRange({ start: 0, end: 0 })
      setYPanOffset(0)
      setYScaleFactor(1)
      return
    }

    const defaultBarsByInterval = {
      '1m': 120,
      '5m': 120,
      '15m': 120,
      '30m': 120,
      '1h': 180,
      '4h': 180,
      '1d': 30,
      '1wk': 52,
      '1mo': 60,
      '3mo': 40
    }

    const bars = defaultBarsByInterval[interval] ?? rows.length
    const end = rows.length - 1
    const start = Math.max(0, end - bars + 1)
    setVisibleRange({ start, end })
    setYPanOffset(0)
    setYScaleFactor(1)
  }

  useEffect(() => {
    if (!symbol) return
    const saved = getStoredInterval(symbol)
    setSelectedInterval(saved)
  }, [symbol])

  useEffect(() => {
    if (!symbol) {
      setSeries([])
      setYPanOffset(0)
      setYScaleFactor(1)
      setLoading(false)
      return
    }

    let mounted = true

    async function fetchCandleData() {
      setLoading(true)
      try {
        const encodedSymbol = encodeURIComponent(symbol)
        const interval = selectedInterval

        if (isNyMarketOpen()) {
          await axios
            .get(`/updateStock?symbol=${encodedSymbol}&interval=${interval}`)
            .catch(() => null)
        }

        let response = await axios.get(`/stockdata?symbol=${encodedSymbol}&interval=${interval}`).catch(() => null)
        let payload = response?.data ?? []

        if (!Array.isArray(payload) || payload.length === 0) {
          await axios.get(`/updateStock?symbol=${encodedSymbol}&interval=${interval}`).catch(() => null)
          response = await axios.get(`/stockdata?symbol=${encodedSymbol}&interval=${interval}`).catch(() => null)
          payload = response?.data ?? []
        }

        const normalized = normalizeCandlesPayload(payload)

        const parsed = normalized
          .map((point) => {
            if (!point || typeof point !== 'object') return null
            const date = parsePointDate(point.dateTime ?? point.date_time ?? point.datetime ?? point.date ?? point.time)
            if (!date) return null

            const open = Number(point.open ?? point.openPrice ?? point.open_price)
            const high = Number(point.high ?? point.highPrice ?? point.high_price)
            const low = Number(point.low ?? point.lowPrice ?? point.low_price)
            const close = Number(point.close ?? point.closePrice ?? point.close_price)

            if (![open, high, low, close].every(Number.isFinite)) return null
            return { date, open, high, low, close }
          })
          .filter(Boolean)
          .sort((left, right) => left.date.getTime() - right.date.getTime())

        let withLast = parsed
        const lastCandleResponse = await axios
          .get(`/lastcandle?symbol=${encodedSymbol}&interval=${interval}`)
          .catch(() => null)
        const normalizedLast = normalizeLastCandlePayload(lastCandleResponse?.data)
        if (normalizedLast) {
          withLast = mergeSeriesWithLastCandle(parsed, normalizedLast)
        }

        if (mounted) {
          setSeries(withLast)
          if (withLast.length > 0) {
            applyDefaultRange(withLast, interval)
          } else {
            setVisibleRange({ start: 0, end: 0 })
            setYPanOffset(0)
            setYScaleFactor(1)
          }
        }
      } catch (error) {
        if (mounted) {
          setSeries([])
          setVisibleRange({ start: 0, end: 0 })
          setYPanOffset(0)
          setYScaleFactor(1)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCandleData()
    return () => { mounted = false }
  }, [symbol, selectedInterval])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!intervalMenuRef.current) return
      if (!intervalMenuRef.current.contains(event.target)) {
        setIsIntervalMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [])

  const visibleSeries = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return []
    const start = clamp(visibleRange.start, 0, series.length - 1)
    const end = clamp(visibleRange.end, start, series.length - 1)
    return series.slice(start, end + 1)
  }, [series, visibleRange])

  const currentPriceMarker = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return null

    const latestPoint = series[series.length - 1]
    if (!latestPoint || !Number.isFinite(latestPoint.close) || !(latestPoint.date instanceof Date)) {
      return null
    }

    const latestDateKey = getNyTradingDateKey(latestPoint.date)
    if (!latestDateKey) return null

    const todayFirstPoint = series.find((point) => {
      if (!(point?.date instanceof Date) || !Number.isFinite(point?.open)) return false
      return getNyTradingDateKey(point.date) === latestDateKey
    })

    if (!todayFirstPoint || !Number.isFinite(todayFirstPoint.open)) return null

    const currentPrice = Number(latestPoint.close)
    const todayOpenPrice = Number(todayFirstPoint.open)
    const isUpFromOpen = currentPrice >= todayOpenPrice

    return {
      price: currentPrice,
      isUpFromOpen
    }
  }, [series])

  const isIntradayInterval = useMemo(() => {
    return ['1m', '5m', '15m', '30m', '1h', '4h'].includes(selectedInterval)
  }, [selectedInterval])

  const chart = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return null
    if (!Array.isArray(visibleSeries) || visibleSeries.length === 0) return null

    const margin = { top: 62, right: RIGHT_PRICE_AXIS_WIDTH, bottom: 32, left: 10 }
    const plotWidth = Math.max(10, width - margin.left - margin.right)
    const plotHeight = Math.max(10, height - margin.top - margin.bottom)

    const lowMin = d3.min(visibleSeries, (point) => point.low)
    const highMax = d3.max(visibleSeries, (point) => point.high)
    if (!Number.isFinite(lowMin) || !Number.isFinite(highMax)) return null

    const yPad = Math.max((highMax - lowMin) * 0.06, highMax === lowMin ? Math.max(1, highMax * 0.02) : 0)
    const yBaseMin = lowMin - yPad
    const yBaseMax = highMax + yPad
    const yBaseSpan = Math.max(1e-6, yBaseMax - yBaseMin)
    const scaledSpan = Math.max(1e-6, yBaseSpan * yScaleFactor)
    const yCenter = ((yBaseMin + yBaseMax) / 2) + yPanOffset
    const yDomainMin = yCenter - (scaledSpan / 2)
    const yDomainMax = yCenter + (scaledSpan / 2)
    const yScale = d3
      .scaleLinear()
      .domain([yDomainMin, yDomainMax])
      .range([margin.top + plotHeight, margin.top])

    const xScale = d3
      .scaleBand()
      .domain(d3.range(Math.max(1, visibleRange.end - visibleRange.start + 1)))
      .range([margin.left, margin.left + plotWidth])
      .padding(0.28)

    const tickCount = Math.min(6, Math.max(3, Math.floor(plotWidth / 120)))
    const xTickIndices = d3.ticks(0, visibleSeries.length - 1, tickCount)
      .map((value) => Math.round(value))
      .filter((value, index, array) => value >= 0 && value < visibleSeries.length && array.indexOf(value) === index)

    return {
      margin,
      plotWidth,
      plotHeight,
      yScale,
      xScale,
      yTicks: yScale.ticks(6),
      xTickIndices,
      candleWidth: Math.max(2, xScale.bandwidth()),
      visibleCount: Math.max(1, visibleRange.end - visibleRange.start + 1),
      yDomainSpan: Math.max(1e-6, yDomainMax - yDomainMin),
      maxYPanOffset: yBaseSpan * 0.5,
      interactionRect: {
        x: margin.left,
        y: Math.max(0, margin.top - 18),
        width: Math.max(10, width - margin.left - 14),
        height: Math.max(10, height - Math.max(0, margin.top - 18) - 14)
      }
    }
  }, [series, visibleSeries, visibleRange, width, height, yPanOffset, yScaleFactor])

  useEffect(() => {
    if (!chart) return
    const nextOffset = clamp(yPanOffset, -chart.maxYPanOffset, chart.maxYPanOffset)
    if (nextOffset !== yPanOffset) {
      setYPanOffset(nextOffset)
    }
  }, [chart, yPanOffset])

  useEffect(() => {
    setCrosshair(null)
  }, [symbol, selectedInterval])

  useEffect(() => {
    const activeSymbol = String(symbol || '').trim()
    if (!activeSymbol) return undefined

    let mounted = true

    const fetchLastCandle = async () => {
      if (!isNyMarketOpen()) return
      try {
        const response = await axios.get(
          `/lastcandle?symbol=${encodeURIComponent(activeSymbol)}&interval=${selectedInterval}`
        )
        const normalizedLast = normalizeLastCandlePayload(response?.data)
        if (!normalizedLast || !mounted) return
        setSeries((prev) => mergeSeriesWithLastCandle(prev, normalizedLast))
      } catch (error) {
        // ignore polling errors
      }
    }

    const timer = setInterval(fetchLastCandle, LAST_CANDLE_POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [symbol, selectedInterval])

  const updateCrosshairFromEvent = (event) => {
    if (!chart || !Array.isArray(visibleSeries) || visibleSeries.length === 0) return

    const offsetX = event.nativeEvent?.offsetX ?? 0
    const offsetY = event.nativeEvent?.offsetY ?? 0

    const xClamped = clamp(offsetX, chart.margin.left, chart.margin.left + chart.plotWidth)
    const yClamped = clamp(offsetY, chart.margin.top, chart.margin.top + chart.plotHeight)

    const totalSlots = Math.max(1, chart.visibleCount)
    const slotWidth = chart.plotWidth / totalSlots
    const rawSlot = Math.round((xClamped - chart.margin.left - (slotWidth / 2)) / Math.max(1e-6, slotWidth))
    const slotIndex = clamp(rawSlot, 0, totalSlots - 1)

    const slotX = chart.xScale(slotIndex)
    const centerX = slotX == null ? xClamped : slotX + (chart.candleWidth / 2)
    const nearestDataIndex = clamp(slotIndex, 0, visibleSeries.length - 1)
    const nearestPoint = visibleSeries[nearestDataIndex]
    if (!nearestPoint?.date) return

    setCrosshair({
      x: centerX,
      y: yClamped,
      price: chart.yScale.invert(yClamped),
      date: nearestPoint.date
    })
  }

  const handleWheel = (event) => {
    if (!chart || !Array.isArray(series) || series.length <= 1) return
    event.preventDefault()

    const minBars = 10
    const maxBars = series.length + RIGHT_OVERSCROLL_BARS
    const start = visibleRange.start
    const end = visibleRange.end
    const currentCount = end - start + 1
    if (currentCount <= 0) return

    const plotLeft = chart.margin.left
    const plotRight = chart.margin.left + chart.plotWidth
    const x = event.nativeEvent.offsetX
    const ratio = clamp((x - plotLeft) / Math.max(1, plotRight - plotLeft), 0, 1)
    const anchor = start + ratio * (currentCount - 1)

    const zoomFactor = event.deltaY < 0 ? 0.85 : 1.2
    const targetCount = clamp(Math.round(currentCount * zoomFactor), minBars, maxBars)

    let newStart = Math.round(anchor - ratio * (targetCount - 1))
    let newEnd = newStart + targetCount - 1

    if (newStart < 0) {
      newStart = 0
      newEnd = targetCount - 1
    }
    const maxEnd = (series.length - 1) + RIGHT_OVERSCROLL_BARS
    if (newEnd > maxEnd) {
      newEnd = maxEnd
      newStart = Math.max(0, newEnd - targetCount + 1)
    }

    setVisibleRange({ start: newStart, end: newEnd })
  }

  const handleMouseDown = (event) => {
    if (!chart || !Array.isArray(series) || series.length <= 1) return
    const pointerX = event.nativeEvent?.offsetX ?? 0
    const pointerY = event.nativeEvent?.offsetY ?? 0
    const onPriceAxis = pointerX >= (chart.margin.left + chart.plotWidth)
    const onBottomAxis = pointerY >= (chart.margin.top + chart.plotHeight)
    setIsDragging(true)
    setDragState({
      mode: onPriceAxis ? 'y-scale' : (onBottomAxis ? 'x-scale' : 'pan'),
      startX: event.clientX,
      startY: event.clientY,
      startYPanOffset: yPanOffset,
      startYScaleFactor: yScaleFactor,
      startRange: { ...visibleRange }
    })
  }

  const handleMouseMove = (event) => {
    if (!isDragging || !dragState || !chart || !Array.isArray(series) || series.length <= 1) return
    const dx = event.clientX - dragState.startX
    const dy = event.clientY - dragState.startY
    const barsPerPixel = chart.visibleCount / Math.max(1, chart.plotWidth)
    const pricePerPixel = chart.yDomainSpan / Math.max(1, chart.plotHeight)
    const shiftBars = Math.round(dx * barsPerPixel)
    const shiftPrice = dy * pricePerPixel

    if (dragState.mode === 'y-scale') {
      const zoomFactor = Math.exp(dy * 0.01)
      const nextYScaleFactor = clamp(
        dragState.startYScaleFactor * zoomFactor,
        MIN_Y_SCALE_FACTOR,
        MAX_Y_SCALE_FACTOR
      )
      setYScaleFactor(nextYScaleFactor)
      return
    }

    if (dragState.mode === 'x-scale') {
      const minBars = 10
      const maxBars = series.length + RIGHT_OVERSCROLL_BARS
      const startCount = dragState.startRange.end - dragState.startRange.start + 1
      const zoomFactor = Math.exp(dx * X_SCALE_DRAG_SENSITIVITY)
      const targetCount = clamp(Math.round(startCount * zoomFactor), minBars, maxBars)
      const center = (dragState.startRange.start + dragState.startRange.end) / 2

      let newStart = Math.round(center - ((targetCount - 1) / 2))
      let newEnd = newStart + targetCount - 1

      if (newStart < 0) {
        newStart = 0
        newEnd = targetCount - 1
      }
      const maxEnd = (series.length - 1) + RIGHT_OVERSCROLL_BARS
      if (newEnd > maxEnd) {
        newEnd = maxEnd
        newStart = Math.max(0, newEnd - targetCount + 1)
      }

      setVisibleRange({ start: newStart, end: newEnd })
      return
    }

    let newStart = dragState.startRange.start - shiftBars
    let newEnd = dragState.startRange.end - shiftBars
    const windowSize = dragState.startRange.end - dragState.startRange.start + 1

    if (newStart < 0) {
      newStart = 0
      newEnd = windowSize - 1
    }
    const maxEnd = (series.length - 1) + RIGHT_OVERSCROLL_BARS
    if (newEnd > maxEnd) {
      newEnd = maxEnd
      newStart = Math.max(0, newEnd - windowSize + 1)
    }

    setVisibleRange({ start: newStart, end: newEnd })
    const nextYPanOffset = clamp(
      dragState.startYPanOffset + shiftPrice,
      -chart.maxYPanOffset,
      chart.maxYPanOffset
    )
    setYPanOffset(nextYPanOffset)
  }

  const stopDragging = () => {
    setIsDragging(false)
    setDragState(null)
  }

  useEffect(() => {
    if (!isDragging) return

    const onWindowMouseMove = (event) => {
      handleMouseMove(event)
    }

    const onWindowMouseUp = () => {
      stopDragging()
    }

    window.addEventListener('mousemove', onWindowMouseMove)
    window.addEventListener('mouseup', onWindowMouseUp)

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [isDragging, dragState, chart, series, visibleRange])

  const selectedIntervalLabel = INTERVAL_OPTIONS.find((option) => option.value === selectedInterval)?.label || selectedInterval
  const localTimezoneAbbr = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      const parts = formatter.formatToParts(new Date())
      return parts.find((part) => part.type === 'timeZoneName')?.value || ''
    } catch (error) {
      return ''
    }
  }, [])

  const handleSelectInterval = (nextInterval) => {
    if (!nextInterval || nextInterval === selectedInterval) {
      setIsIntervalMenuOpen(false)
      return
    }
    setSelectedInterval(nextInterval)
    setStoredInterval(symbol, nextInterval)
    setIsIntervalMenuOpen(false)
  }

  return (
    <div className="treemap-candle-view">
      <button type="button" className="treemap-candle-back" onClick={onBack}>← Back</button>
      <div className="treemap-candle-title">{symbol || '-'} Candlestick{localTimezoneAbbr ? ` (${localTimezoneAbbr})` : ''}</div>
      <div className="treemap-candle-interval" ref={intervalMenuRef}>
        <button
          type="button"
          className="treemap-candle-interval-btn"
          aria-haspopup="listbox"
          aria-expanded={isIntervalMenuOpen}
          onClick={() => setIsIntervalMenuOpen((open) => !open)}
        >
          {selectedIntervalLabel} ▾
        </button>
        {isIntervalMenuOpen && (
          <div className="treemap-candle-interval-menu" role="listbox" aria-label="Select interval">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`treemap-candle-interval-item ${selectedInterval === option.value ? 'active' : ''}`}
                onClick={() => handleSelectInterval(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="treemap-candle-empty">Loading candlestick...</div>
      ) : !chart ? (
        <div className="treemap-candle-empty">No candlestick data</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="treemap-candle-svg" role="img" aria-label="Stock candlestick chart">
          <defs>
            <clipPath id={clipPathId}>
              <rect
                x={chart.margin.left}
                y={chart.margin.top}
                width={chart.plotWidth}
                height={chart.plotHeight}
              />
            </clipPath>
          </defs>

          <rect x="0" y="0" width={width} height={height} fill="transparent" />

          {chart.yTicks.map((tick, index) => (
            <g key={`y_tick_${index}`}>
              <line
                x1={chart.margin.left}
                x2={chart.margin.left + chart.plotWidth}
                y1={chart.yScale(tick)}
                y2={chart.yScale(tick)}
                stroke="rgba(255,255,255,0.09)"
              />
              <text
                x={width - 6}
                y={chart.yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="treemap-candle-axis"
              >
                {Number(tick).toFixed(2)}
              </text>
            </g>
          ))}

          <g clipPath={`url(#${clipPathId})`}>
            {visibleSeries.map((point, index) => {
              const x = chart.xScale(index)
              if (x == null) return null
              const centerX = x + chart.candleWidth / 2
              const openY = chart.yScale(point.open)
              const closeY = chart.yScale(point.close)
              const highY = chart.yScale(point.high)
              const lowY = chart.yScale(point.low)
              const bodyY = Math.min(openY, closeY)
              const bodyHeight = Math.max(1.4, Math.abs(closeY - openY))
              const isUp = point.close >= point.open
              const candleColor = isUp ? '#14b8a6' : '#ff4d5a'

              return (
                <g key={`candle_${index}`}>
                  <line x1={centerX} x2={centerX} y1={highY} y2={lowY} stroke={candleColor} strokeWidth="1.2" />
                  <rect x={x} y={bodyY} width={chart.candleWidth} height={bodyHeight} fill={candleColor} />
                </g>
              )
            })}
          </g>

          {chart.xTickIndices.map((index) => {
            const x = chart.xScale(index)
            if (x == null) return null
            const centerX = x + chart.candleWidth / 2
            const point = visibleSeries[index]
            return (
              <g key={`x_tick_${index}`}>
                <line
                  x1={centerX}
                  x2={centerX}
                  y1={chart.margin.top}
                  y2={chart.margin.top + chart.plotHeight}
                  stroke="rgba(255,255,255,0.05)"
                />
                <text
                  x={centerX}
                  y={height - 22}
                  textAnchor="middle"
                  className="treemap-candle-axis"
                >
                  {d3.timeFormat('%m/%d')(point.date)}
                </text>
              </g>
            )
          })}

          {currentPriceMarker && Number.isFinite(currentPriceMarker.price) && (() => {
            const markerY = chart.yScale(currentPriceMarker.price)
            if (!Number.isFinite(markerY) || markerY < chart.margin.top || markerY > (chart.margin.top + chart.plotHeight)) {
              return null
            }

            const markerColor = currentPriceMarker.isUpFromOpen ? '#14b8a6' : '#ff4d5a'
            const markerLabelX = Math.min(
              chart.margin.left + chart.plotWidth + 2,
              width - CROSSHAIR_PRICE_LABEL_WIDTH - 2
            )

            return (
              <g>
                <line
                  x1={chart.margin.left}
                  x2={chart.margin.left + chart.plotWidth}
                  y1={markerY}
                  y2={markerY}
                  stroke={markerColor}
                  strokeDasharray="5 5"
                  strokeWidth="1.1"
                />
                <rect
                  x={markerLabelX}
                  y={markerY - 10}
                  width={CROSSHAIR_PRICE_LABEL_WIDTH}
                  height={20}
                  rx={2}
                  fill={markerColor}
                />
                <text
                  x={markerLabelX + (CROSSHAIR_PRICE_LABEL_WIDTH / 2)}
                  y={markerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="treemap-candle-axis"
                  fill="#ffffff"
                >
                  {currentPriceMarker.price.toFixed(2)}
                </text>
              </g>
            )
          })()}

          {visibleSeries.map((point, index) => {
            const pointDate = point?.date
            if (!(pointDate instanceof Date)) return null

            const absoluteIndex = visibleRange.start + index
            const previousPoint = absoluteIndex > 0 ? series[absoluteIndex - 1] : null
            const previousDate = previousPoint?.date

            const currentYear = pointDate.getFullYear()
            const previousYear = previousDate instanceof Date ? previousDate.getFullYear() : null
            const isFirstTradingDayOfYear = previousYear == null || currentYear !== previousYear
            if (!isFirstTradingDayOfYear) return null

            const x = chart.xScale(index)
            if (x == null) return null
            const centerX = x + chart.candleWidth / 2
            return (
              <text
                key={`year_${index}`}
                x={centerX}
                y={height - 8}
                textAnchor="middle"
                className="treemap-candle-axis"
              >
                {d3.timeFormat('%Y')(point.date)}
              </text>
            )
          })}

          {crosshair && (
            <g>
              <line
                x1={chart.margin.left}
                x2={chart.margin.left + chart.plotWidth}
                y1={crosshair.y}
                y2={crosshair.y}
                stroke="rgba(255,255,255,0.65)"
                strokeDasharray="5 5"
                strokeWidth="1"
              />
              <line
                x1={crosshair.x}
                x2={crosshair.x}
                y1={chart.margin.top}
                y2={chart.margin.top + chart.plotHeight}
                stroke="rgba(255,255,255,0.65)"
                strokeDasharray="5 5"
                strokeWidth="1"
              />

              <rect
                x={Math.min(chart.margin.left + chart.plotWidth + 2, width - CROSSHAIR_PRICE_LABEL_WIDTH - 2)}
                y={crosshair.y - 10}
                width={CROSSHAIR_PRICE_LABEL_WIDTH}
                height={20}
                rx={2}
                fill="rgba(24, 28, 36, 0.95)"
                stroke="rgba(255,255,255,0.28)"
              />
              <text
                x={Math.min(chart.margin.left + chart.plotWidth + 2, width - CROSSHAIR_PRICE_LABEL_WIDTH - 2) + (CROSSHAIR_PRICE_LABEL_WIDTH / 2)}
                y={crosshair.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="treemap-candle-axis"
                fill="#ffffff"
              >
                {Number(crosshair.price).toFixed(2)}
              </text>

              <rect
                x={clamp(crosshair.x - (isIntradayInterval ? 66 : 51), chart.margin.left, chart.margin.left + chart.plotWidth - (isIntradayInterval ? 132 : 102))}
                y={height - 34}
                width={isIntradayInterval ? 132 : 102}
                height={20}
                rx={2}
                fill="rgba(24, 28, 36, 0.95)"
                stroke="rgba(255,255,255,0.28)"
              />
              <text
                x={clamp(crosshair.x, chart.margin.left + (isIntradayInterval ? 66 : 51), chart.margin.left + chart.plotWidth - (isIntradayInterval ? 66 : 51))}
                y={height - 22}
                textAnchor="middle"
                className="treemap-candle-axis"
                fill="#ffffff"
              >
                {`${d3.timeFormat(isIntradayInterval ? '%Y-%m-%d %H:%M' : '%Y-%m-%d')(crosshair.date)}${localTimezoneAbbr ? ` ${localTimezoneAbbr}` : ''}`}
              </text>
            </g>
          )}

          <rect
            x={chart.interactionRect.x}
            y={chart.interactionRect.y}
            width={chart.interactionRect.width}
            height={chart.interactionRect.height}
            fill="transparent"
            style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={(event) => {
              if (isDragging) return
              updateCrosshairFromEvent(event)
            }}
            onMouseLeave={() => {
              if (isDragging) return
              setCrosshair(null)
            }}
          />
        </svg>
      )}
    </div>
  )
}
