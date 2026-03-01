import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import * as d3 from 'd3'
import './App.css'
import Treemap from './Treemap'

const NEWS_PLACEHOLDERS = [
  'News slot 1',
  'News slot 2',
  'News slot 3',
  'News slot 4',
  'News slot 5'
]

const numberFormatter = new Intl.NumberFormat('en-US')

function formatSignedPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const numeric = Number(value)
  const fixed = numeric.toFixed(2)
  return `${numeric > 0 ? '+' : ''}${fixed}%`
}

function formatCompactNumber(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function formatMillions(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${(Number(value) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}M`
}

function extractNumericValue(point) {
  if (point == null) return null
  if (typeof point === 'number' && Number.isFinite(point)) return point
  if (typeof point === 'string') {
    const value = Number(point)
    return Number.isFinite(value) ? value : null
  }
  if (Array.isArray(point)) {
    for (let index = point.length - 1; index >= 0; index--) {
      const value = extractNumericValue(point[index])
      if (value != null) return value
    }
    return null
  }
  if (typeof point === 'object') {
    const candidates = [
      point.close,
      point.closePrice,
      point.close_price,
      point.open,
      point.openPrice,
      point.open_price,
      point.high,
      point.highPrice,
      point.high_price,
      point.low,
      point.lowPrice,
      point.low_price,
      point.adjClose,
      point.adj_close,
      point.price,
      point.currentPrice,
      point.c,
      point.value
    ]
    for (const candidate of candidates) {
      const value = extractNumericValue(candidate)
      if (value != null) return value
    }
  }
  return null
}

function extractPointDate(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return null
  const raw = point.dateTime ?? point.date_time ?? point.datetime ?? point.date ?? point.time ?? null
  if (raw == null) return null

  if (Array.isArray(raw) && raw.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0, nano = 0] = raw
    const millis = Math.floor((Number(nano) || 0) / 1_000_000)
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), millis)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeSeriesPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.prices)) return payload.prices
  if (Array.isArray(payload.points)) return payload.points

  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (Array.isArray(timestamps) && Array.isArray(closes)) {
    const rows = []
    const count = Math.min(timestamps.length, closes.length)
    for (let index = 0; index < count; index++) {
      rows.push({
        dateTime: new Date(Number(timestamps[index]) * 1000).toISOString(),
        close: closes[index]
      })
    }
    return rows
  }

  return []
}

function StockTrendChart({ series, loading }) {
  const width = 320
  const height = 170
  const margin = { top: 12, right: 10, bottom: 20, left: 4 }
  const yAxisGutter = 32

  const chart = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return null
    const valid = series.filter(point => point && point.date instanceof Date && Number.isFinite(point.value))
    if (valid.length === 0) return null

    const innerWidth = width - margin.left - margin.right - yAxisGutter
    const innerHeight = height - margin.top - margin.bottom

    const xDomain = d3.extent(valid, point => point.date)
    if (!xDomain[0] || !xDomain[1]) return null

    const yMin = d3.min(valid, point => point.value)
    const yMax = d3.max(valid, point => point.value)
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return null

    const yPad = Math.max((yMax - yMin) * 0.08, yMax === yMin ? Math.max(1, yMax * 0.02) : 0)
    const xScale = d3.scaleUtc().domain(xDomain).range([yAxisGutter, yAxisGutter + innerWidth])
    const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).nice().range([innerHeight, 0])
    const line = d3.line().x(point => xScale(point.date)).y(point => yScale(point.value)).curve(d3.curveLinear)

    return {
      innerWidth,
      innerHeight,
      yAxisGutter,
      xScale,
      yScale,
      linePath: line(valid),
      xTicks: xScale.ticks(4),
      yTicks: yScale.ticks(4)
    }
  }, [series])

  if (loading) {
    return (
      <div className="trend-chart-fixed">
        <div className="chart-empty">Loading trend...</div>
      </div>
    )
  }

  if (!chart) {
    return (
      <div className="trend-chart-fixed">
        <div className="chart-empty">No trend data ({Array.isArray(series) ? series.length : 0} points)</div>
      </div>
    )
  }

  return (
    <div className="trend-chart-fixed">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="trend-svg" role="img" aria-label="30 day stock trend chart">
        <rect x="0" y="0" width={width} height={height} fill="transparent" stroke="rgba(255,255,255,0.24)" />
        <g transform={`translate(${margin.left},${margin.top})`}>
          {chart.yTicks.map((tick, index) => (
            <g key={`y_${index}`}>
              <line x1={chart.yAxisGutter} x2={chart.yAxisGutter + chart.innerWidth} y1={chart.yScale(tick)} y2={chart.yScale(tick)} stroke="rgba(255,255,255,0.08)" />
              <text x={chart.yAxisGutter - 4} y={chart.yScale(tick)} textAnchor="end" dominantBaseline="middle" className="axis-label">{formatCompactNumber(tick)}</text>
            </g>
          ))}
          {chart.xTicks.map((tick, index) => (
            <g key={`x_${index}`} transform={`translate(${chart.xScale(tick)},0)`}>
              <line y1="0" y2={chart.innerHeight} stroke="rgba(255,255,255,0.06)" />
              <text y={chart.innerHeight + 14} textAnchor="middle" className="axis-label">{d3.timeFormat('%m/%d')(tick)}</text>
            </g>
          ))}
          {chart.linePath && <path d={chart.linePath} fill="none" stroke="#4ddc7c" strokeWidth="2" />}
        </g>
      </svg>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSymbol, setSelectedSymbol] = useState(null)
  const [chartSeries, setChartSeries] = useState([])
  const [currentInfo, setCurrentInfo] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)

  const selectedHeatMapItem = useMemo(() => {
    if (!selectedSymbol) return null
    const symbol = String(selectedSymbol).trim().toUpperCase()
    return data.find(item => String(item?.symbol || '').trim().toUpperCase() === symbol) || null
  }, [data, selectedSymbol])

  const sidebarData = useMemo(() => {
    if (!selectedSymbol) return null
    const item = selectedHeatMapItem || {}
    const currentPrice = item.currentPrice ?? item.current_price ?? currentInfo?.price ?? null
    const changePercent = item.changePercent ?? item.change_percent ?? currentInfo?.changePct ?? null
    return {
      symbol: selectedSymbol,
      security: item.security ?? item.shortName ?? '-',
      sector: item.gicsSector ?? item.gics_sector ?? item.sector ?? '-',
      currentPrice,
      changePercent,
      marketCap: item.marketCap ?? item.market_cap ?? null,
      volume: item.volume ?? null,
      dayHigh: item.regularMarketDayHigh ?? item.regular_market_day_high ?? null,
      dayLow: item.regularMarketDayLow ?? item.regular_market_day_low ?? null
    }
  }, [selectedSymbol, selectedHeatMapItem, currentInfo])

  const quoteToneClass = (() => {
    const numeric = Number(sidebarData?.changePercent)
    if (!Number.isFinite(numeric) || numeric === 0) return 'quote-neutral'
    return numeric > 0 ? 'quote-up' : 'quote-down'
  })()

  useEffect(() => {
    if (!selectedSymbol) {
      setChartSeries([])
      setCurrentInfo(null)
      setChartLoading(false)
      return
    }
    let mounted = true
    setChartLoading(true)

    async function fetchChartFor(sym) {
      try {
        const realP = axios.get(`/realTimeStock?symbol=${encodeURIComponent(sym)}`).catch(() => null)
        const seriesP = axios.get(`/recent30Data?symbol=${encodeURIComponent(sym)}&interval=1d`)
          .catch(() => axios.get(`/stockdata?symbol=${encodeURIComponent(sym)}&interval=1d`))

        const [realRes, seriesRes] = await Promise.all([realP, seriesP])

        if (!mounted) return

        const realData = realRes && realRes.data ? realRes.data : null
        const parsedReal = realData ? (
          typeof realData === 'object' ? ({ price: realData.price || realData.currentPrice || realData.last || null, changePct: realData.changePercent != null ? Number(realData.changePercent) : (realData.change != null ? Number(realData.change) : null) }) : null
        ) : null
        if (parsedReal) setCurrentInfo(parsedReal)

        let seriesPayload = normalizeSeriesPayload(seriesRes && seriesRes.data ? seriesRes.data : [])

        let parsedSeries = []
        if (seriesPayload.length > 0) {
          parsedSeries = seriesPayload
            .map((point, index) => {
              const value = extractNumericValue(point)
              if (value == null) return null
              const parsedDate = extractPointDate(point)
              const fallbackDate = new Date(Date.now() - ((seriesPayload.length - 1 - index) * 24 * 60 * 60 * 1000))
              return { date: parsedDate || fallbackDate, value }
            })
            .filter(Boolean)
        }

        if (mounted) {
          const trimmed = parsedSeries
            .slice(-30)
            .sort((left, right) => left.date.getTime() - right.date.getTime())
          setChartSeries(trimmed)
        }
      } catch (err) {
        console.warn('chart fetch err', err)
        if (mounted) {
          setChartSeries([])
          const fallback = data.find(d => d.symbol === selectedSymbol) || null
          if (fallback) setCurrentInfo({ price: fallback.currentPrice || fallback.price, changePct: fallback.changePercent })
        }
      } finally {
        if (mounted) setChartLoading(false)
      }
    }

    fetchChartFor(selectedSymbol)
    return () => { mounted = false }
  }, [selectedSymbol, data])
  useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        const res = await axios.get('/heatMapData')
        let payload = res && res.data
        if (!Array.isArray(payload)) {
          if (payload && Array.isArray(payload.data)) payload = payload.data
          else if (payload && Array.isArray(payload.heatMapData)) payload = payload.heatMapData
          else if (payload && Array.isArray(payload.heatmapData)) payload = payload.heatmapData
          else payload = []
        }
        if (mounted) setData(payload)
      } catch (e) {
        // fallback sample data
        if (mounted) setData([
          { symbol: 'AAPL', marketCap: 3000000000000, volume: 300, changePercent: 1.2, currentPrice: 172 },
          { symbol: 'MSFT', marketCap: 2800000000000, volume: 220, changePercent: -0.8, currentPrice: 310 },
          { symbol: 'GOOG', marketCap: 2000000000000, volume: 180, changePercent: 0.4, currentPrice: 125 },
          { symbol: 'AMZN', marketCap: 1900000000000, volume: 140, changePercent: -2.1, currentPrice: 98 },
          { symbol: 'TSLA', marketCap: 900000000000, volume: 260, changePercent: 3.5, currentPrice: 720 }
        ])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>FP Stock</h1>
      </header>

      <div className="toolbar">
        <div className="toolbar-inner">工具列 / 控制區（可放選單、按鈕）</div>
      </div>

      <main className="main">
        <section className="heatmap">{/* 藍色區塊：Heatmap (Treemap) */}
          {loading ? (
            <div className="heatmap-inner">Loading...</div>
          ) : (
            <Treemap data={data} groupOutlineInset={1} groupOutlineWidth={2} onSelectSymbol={setSelectedSymbol} />
          )}
        </section>

        <aside className="sidebar" aria-label="Sidebar">
          <div className="sidebar-inner">
            {!selectedSymbol ? (
              <div className="sidebar-empty">Select a stock from heatmap</div>
            ) : (
              <>
                <section className="sidebar-card stock-frame">
                  <div className="stock-top">
                    <div className="stock-sector-top">{sidebarData?.sector || '-'}</div>
                    <div />
                    <div className="stock-symbol-top">{sidebarData?.symbol || '-'}</div>
                    <div className={`stock-price-top ${quoteToneClass}`}>{sidebarData?.currentPrice != null ? Number(sidebarData.currentPrice).toFixed(2) : '-'}</div>
                    <div className="stock-security-top">{sidebarData?.security || '-'}</div>
                    <div className={`stock-change-top ${quoteToneClass}`}>{formatSignedPercent(sidebarData?.changePercent)}</div>
                  </div>

                  <div className="stock-metrics-grid">
                    <div className="stock-label">Market Cap</div><div className="stock-value">{sidebarData?.marketCap != null ? formatMillions(sidebarData.marketCap) : '-'}</div>
                    <div className="stock-label">Volume</div><div className="stock-value">{sidebarData?.volume != null ? numberFormatter.format(Number(sidebarData.volume)) : '-'}</div>
                    <div className="stock-label">Day High</div><div className="stock-value">{sidebarData?.dayHigh != null ? Number(sidebarData.dayHigh).toFixed(2) : '-'}</div>
                    <div className="stock-label">Day Low</div><div className="stock-value">{sidebarData?.dayLow != null ? Number(sidebarData.dayLow).toFixed(2) : '-'}</div>
                  </div>
                </section>

                <section className="sidebar-card trend-frame">
                  <StockTrendChart series={chartSeries} loading={chartLoading} />
                </section>

                <section className="sidebar-card news-frame">
                  <div className="sidebar-subtitle">Stock News (Top 5)</div>
                  <ul className="news-placeholder-list">
                    {NEWS_PLACEHOLDERS.map((item, index) => (
                      <li key={`news_${index}`} className="news-placeholder-item">{item}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </aside>

      </main>
    </div>
  )
}
