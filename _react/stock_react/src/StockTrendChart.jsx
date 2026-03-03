import React, { useMemo } from 'react'
import * as d3 from 'd3'

function formatCompactNumber(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

export default function StockTrendChart({ series, loading }) {
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
