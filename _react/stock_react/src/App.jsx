import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import './App.css'
import Treemap from './Treemap'
import Sidebar from './Sidebar'

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

export default function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSymbol, setSelectedSymbol] = useState(null)
  const [chartSeries, setChartSeries] = useState([])
  const [currentInfo, setCurrentInfo] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [gspcInfo, setGspcInfo] = useState({ price: null, changePct: null })
  const [heatmapLastUpdated, setHeatmapLastUpdated] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [candleOpenRequest, setCandleOpenRequest] = useState(null)
  const searchRef = useRef(null)
  const dataRef = useRef([])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const formatSignedPercent = (value) => {
    if (value == null || Number.isNaN(Number(value))) return '-'
    const numeric = Number(value)
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(2)}%`
  }

  const selectedHeatMapItem = useMemo(() => {
    if (!selectedSymbol) return null
    const symbol = String(selectedSymbol).trim().toUpperCase()
    return data.find(item => String(item?.symbol || '').trim().toUpperCase() === symbol) || null
  }, [data, selectedSymbol])

  const sidebarData = useMemo(() => {
    if (!selectedSymbol) return null
    const item = selectedHeatMapItem || {}
    const normalizedSymbol = String(selectedSymbol).trim().toUpperCase()
    const inferredSector = normalizedSymbol.startsWith('^') ? 'Index' : '-'
    const currentPrice = item.currentPrice ?? item.current_price ?? currentInfo?.price ?? null
    const changePercent = item.changePercent ?? item.change_percent ?? currentInfo?.changePct ?? null
    return {
      symbol: selectedSymbol,
      security: item.security ?? item.shortName ?? currentInfo?.security ?? '-',
      sector: item.gicsSector ?? item.gics_sector ?? item.sector ?? currentInfo?.sector ?? inferredSector,
      currentPrice,
      changePercent,
      marketCap: item.marketCap ?? item.market_cap ?? currentInfo?.marketCap ?? null,
      volume: item.volume ?? currentInfo?.volume ?? null,
      dayHigh: item.regularMarketDayHigh ?? item.regular_market_day_high ?? currentInfo?.dayHigh ?? null,
      dayLow: item.regularMarketDayLow ?? item.regular_market_day_low ?? currentInfo?.dayLow ?? null
    }
  }, [selectedSymbol, selectedHeatMapItem, currentInfo])

  const searchableStocks = useMemo(() => {
    const stockMap = new Map()
    for (const item of data) {
      const symbol = String(item?.symbol || '').trim().toUpperCase()
      if (!symbol) continue
      if (!stockMap.has(symbol)) {
        stockMap.set(symbol, {
          symbol,
          security: String(item?.security || item?.shortName || '').trim()
        })
      }
    }
    return Array.from(stockMap.values())
  }, [data])

  const searchSuggestions = useMemo(() => {
    const query = String(searchTerm || '').trim().toUpperCase()
    if (!query) return []

    const ranked = searchableStocks
      .map((item) => {
        const symbol = item.symbol
        const securityUpper = String(item.security || '').toUpperCase()
        const symbolStarts = symbol.startsWith(query)
        const symbolIncludes = !symbolStarts && symbol.includes(query)
        const securityIncludes = !symbolStarts && !symbolIncludes && securityUpper.includes(query)

        let score = 99
        if (symbolStarts) score = 0
        else if (symbolIncludes) score = 1
        else if (securityIncludes) score = 2

        return {
          ...item,
          score
        }
      })
      .filter((item) => item.score < 99)
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score
        return left.symbol.localeCompare(right.symbol)
      })

    return ranked.slice(0, 5)
  }, [searchTerm, searchableStocks])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!searchRef.current) return
      if (!searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const openSymbolCandlestick = (symbol) => {
    const normalized = String(symbol || '').trim().toUpperCase()
    if (!normalized) return
    setSelectedSymbol(normalized)
    setCandleOpenRequest({ symbol: normalized, nonce: Date.now() })
    setSearchTerm(normalized)
    setShowSearchDropdown(false)
  }

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
        const parsedReal = realData && typeof realData === 'object'
          ? (() => {
              const firstQuote = realData?.quoteResponse?.result?.[0] ?? null
              const rawPrice = realData.price
                ?? realData.currentPrice
                ?? realData.last
                ?? firstQuote?.regularMarketPrice
                ?? firstQuote?.postMarketPrice
                ?? null
              const rawChangePct = realData.changePercent
                ?? realData.change
                ?? firstQuote?.regularMarketChangePercent
                ?? firstQuote?.postMarketChangePercent
                ?? null
              const rawVolume = realData.volume
                ?? firstQuote?.regularMarketVolume
                ?? null
              const rawDayHigh = realData.dayHigh
                ?? realData.regularMarketDayHigh
                ?? firstQuote?.regularMarketDayHigh
                ?? null
              const rawDayLow = realData.dayLow
                ?? realData.regularMarketDayLow
                ?? firstQuote?.regularMarketDayLow
                ?? null
              const rawMarketCap = realData.marketCap
                ?? firstQuote?.marketCap
                ?? null
              const security = realData.security
                ?? realData.shortName
                ?? firstQuote?.shortName
                ?? firstQuote?.longName
                ?? null
              const sector = realData.sector
                ?? firstQuote?.sector
                ?? null
              return {
                price: rawPrice != null && Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : null,
                changePct: rawChangePct != null && Number.isFinite(Number(rawChangePct)) ? Number(rawChangePct) : null,
                volume: rawVolume != null && Number.isFinite(Number(rawVolume)) ? Number(rawVolume) : null,
                dayHigh: rawDayHigh != null && Number.isFinite(Number(rawDayHigh)) ? Number(rawDayHigh) : null,
                dayLow: rawDayLow != null && Number.isFinite(Number(rawDayLow)) ? Number(rawDayLow) : null,
                marketCap: rawMarketCap != null && Number.isFinite(Number(rawMarketCap)) ? Number(rawMarketCap) : null,
                security,
                sector
              }
            })()
          : null
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
          const fallback = dataRef.current.find((item) => item.symbol === sym) || null
          if (fallback) setCurrentInfo({ price: fallback.currentPrice || fallback.price, changePct: fallback.changePercent })
        }
      } finally {
        if (mounted) setChartLoading(false)
      }
    }

    fetchChartFor(selectedSymbol)
    return () => { mounted = false }
  }, [selectedSymbol])

  useEffect(() => {
    let mounted = true

    async function fetchGspc() {
      try {
        const response = await axios.get(`/realTimeStock?symbol=${encodeURIComponent('^GSPC')}`)
        const payload = response?.data
        if (!mounted || !payload || typeof payload !== 'object') return

        const firstQuote = payload?.quoteResponse?.result?.[0] ?? null

        const rawPrice = payload.price
          ?? payload.currentPrice
          ?? payload.last
          ?? firstQuote?.regularMarketPrice
          ?? firstQuote?.postMarketPrice
          ?? null

        const rawChangePct = payload.changePercent
          ?? payload.change
          ?? firstQuote?.regularMarketChangePercent
          ?? firstQuote?.postMarketChangePercent
          ?? null

        const price = rawPrice != null && Number.isFinite(Number(rawPrice)) ? Number(rawPrice) : null
        const changePct = rawChangePct != null && Number.isFinite(Number(rawChangePct)) ? Number(rawChangePct) : null

        setGspcInfo({ price, changePct })
      } catch (error) {
        if (mounted) {
          setGspcInfo({ price: null, changePct: null })
        }
      }
    }

    fetchGspc()
    const timer = setInterval(fetchGspc, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function fetchData(isInitial = false) {
      try {
        const res = await axios.get('/heatMapData')
        let payload = res && res.data
        if (!Array.isArray(payload)) {
          if (payload && Array.isArray(payload.data)) payload = payload.data
          else if (payload && Array.isArray(payload.heatMapData)) payload = payload.heatMapData
          else if (payload && Array.isArray(payload.heatmapData)) payload = payload.heatmapData
          else payload = []
        }
        if (mounted) {
          setData(payload)
          setHeatmapLastUpdated(new Date())
        }
      } catch (e) {
        if (isInitial && mounted) {
          setData([
            { symbol: 'AAPL', marketCap: 3000000000000, volume: 300, changePercent: 1.2, currentPrice: 172 },
            { symbol: 'MSFT', marketCap: 2800000000000, volume: 220, changePercent: -0.8, currentPrice: 310 },
            { symbol: 'GOOG', marketCap: 2000000000000, volume: 180, changePercent: 0.4, currentPrice: 125 },
            { symbol: 'AMZN', marketCap: 1900000000000, volume: 140, changePercent: -2.1, currentPrice: 98 },
            { symbol: 'TSLA', marketCap: 900000000000, volume: 260, changePercent: 3.5, currentPrice: 720 }
          ])
        }
      } finally {
        if (isInitial && mounted) setLoading(false)
      }
    }

    fetchData(true)
    const timer = setInterval(() => {
      fetchData(false)
    }, 5000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>FP Stock</h1>
      </header>

      <div className="toolbar">
        <div className="toolbar-inner">
          <div className="toolbar-left">
            <div
              className="toolbar-index-box"
              role="button"
              tabIndex={0}
              aria-label="Show SP500 details"
              onClick={() => setSelectedSymbol('^GSPC')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedSymbol('^GSPC')
                }
              }}
            >
              <span className="toolbar-index-symbol">SP500:</span>
              <span className={`toolbar-index-price ${gspcInfo.changePct > 0 ? 'quote-up' : (gspcInfo.changePct < 0 ? 'quote-down' : '')}`}>{gspcInfo.price != null ? Number(gspcInfo.price).toFixed(2) : '-'}</span>
              <span className={`toolbar-index-change ${gspcInfo.changePct > 0 ? 'quote-up' : (gspcInfo.changePct < 0 ? 'quote-down' : '')}`}>
                {formatSignedPercent(gspcInfo.changePct)}
              </span>
            </div>
          </div>

          <div className="toolbar-search" ref={searchRef}>
            <input
              className="toolbar-search-input"
              type="text"
              value={searchTerm}
              placeholder="Search symbol..."
              onFocus={() => setShowSearchDropdown(true)}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setShowSearchDropdown(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const first = searchSuggestions[0]
                  if (first?.symbol) {
                    openSymbolCandlestick(first.symbol)
                  }
                }
              }}
            />

            {showSearchDropdown && searchSuggestions.length > 0 && (
              <div className="toolbar-search-menu" role="listbox" aria-label="Stock search suggestions">
                {searchSuggestions.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className="toolbar-search-item"
                    onClick={() => openSymbolCandlestick(item.symbol)}
                  >
                    <span className="toolbar-search-item-symbol">{item.symbol}</span>
                    <span className="toolbar-search-item-name">{item.security || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="main">
        <section className="heatmap">{/* 藍色區塊：Heatmap (Treemap) */}
          {loading ? (
            <div className="heatmap-inner">Loading...</div>
          ) : (
            <Treemap
              data={data}
              groupOutlineInset={1}
              groupOutlineWidth={2}
              onSelectSymbol={setSelectedSymbol}
              externalCandleRequest={candleOpenRequest}
            />
          )}
        </section>

        <Sidebar
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          sidebarData={sidebarData}
          chartSeries={chartSeries}
          chartLoading={chartLoading}
        />

      </main>

      <div className="app-heatmap-updated" aria-live="polite">
        Data Updated: {heatmapLastUpdated ? heatmapLastUpdated.toLocaleTimeString() : '-'}
      </div>
    </div>
  )
}
