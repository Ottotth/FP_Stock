import React, { useEffect, useMemo, useState } from 'react'
import StockTrendChart from './StockTrendChart'

const NEWS_LIMIT = 5

const numberFormatter = new Intl.NumberFormat('en-US')

function formatSignedPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const numeric = Number(value)
  const fixed = numeric.toFixed(2)
  return `${numeric > 0 ? '+' : ''}${fixed}%`
}

function formatMillions(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${(Number(value) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}M`
}

export default function Sidebar({ selectedSymbol, onSelectSymbol, sidebarData, chartSeries, chartLoading }) {
  const [newsItems, setNewsItems] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)

  useEffect(() => {
    if (!selectedSymbol && typeof onSelectSymbol === 'function') {
      onSelectSymbol('^GSPC')
    }
  }, [selectedSymbol, onSelectSymbol])

  useEffect(() => {
    const symbol = String(selectedSymbol || '').trim().toUpperCase()
    if (!symbol) {
      setNewsItems([])
      setNewsLoading(false)
      return
    }

    let active = true
    const controller = new AbortController()

    async function fetchNews() {
      setNewsLoading(true)
      try {
        const response = await fetch(
          `/stockNews?symbol=${encodeURIComponent(symbol)}&newsCount=${NEWS_LIMIT}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const payload = await response.json()
        const list = Array.isArray(payload?.news) ? payload.news : []
        const normalized = list
          .map((item) => ({
            uuid: item?.uuid || `${item?.link || ''}_${item?.title || ''}`,
            title: item?.title || '-',
            link: item?.link || null
          }))
          .filter((item) => item.title && item.title !== '-')
          .slice(0, NEWS_LIMIT)

        if (active) setNewsItems(normalized)
      } catch (error) {
        if (error?.name !== 'AbortError' && active) {
          setNewsItems([])
        }
      } finally {
        if (active) setNewsLoading(false)
      }
    }

    fetchNews()

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedSymbol])

  const newsDisplayItems = useMemo(() => {
    if (newsLoading) {
      return Array.from({ length: NEWS_LIMIT }, (_, index) => ({
        uuid: `loading_${index}`,
        title: 'Loading news...',
        link: null
      }))
    }

    const normalized = newsItems.slice(0, NEWS_LIMIT)
    if (normalized.length < NEWS_LIMIT) {
      for (let index = normalized.length; index < NEWS_LIMIT; index++) {
        normalized.push({
          uuid: `empty_${index}`,
          title: 'No news available',
          link: null
        })
      }
    }
    return normalized
  }, [newsItems, newsLoading])

  const quoteToneClass = (() => {
    const numeric = Number(sidebarData?.changePercent)
    if (!Number.isFinite(numeric) || numeric === 0) return 'quote-neutral'
    return numeric > 0 ? 'quote-up' : 'quote-down'
  })()

  return (
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
              <div className="sidebar-subtitle">Stock News</div>
              <ul className="news-placeholder-list">
                {newsDisplayItems.map((item) => (
                  <li key={item.uuid} className="news-placeholder-item" title={item.title}>
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-link"
                        title={item.title}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="news-text" title={item.title}>{item.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  )
}
