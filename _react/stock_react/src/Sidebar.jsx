import React, { useEffect } from 'react'
import StockTrendChart from './StockTrendChart'

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

function formatMillions(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${(Number(value) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}M`
}

export default function Sidebar({ selectedSymbol, onSelectSymbol, sidebarData, chartSeries, chartLoading }) {
  useEffect(() => {
    if (!selectedSymbol && typeof onSelectSymbol === 'function') {
      onSelectSymbol('^GSPC')
    }
  }, [selectedSymbol, onSelectSymbol])

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
  )
}
