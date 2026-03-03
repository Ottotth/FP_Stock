import React, { useMemo, useRef, useEffect, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import CandlestickView from './CandlestickView'

function colorFor(change) {
  // 變動以百分比表示；產生一個綠↔灰↔紅的配色，並控制明度
  const c = Math.max(-20, Math.min(20, Number(change) || 0))
  // 中性/零：使用適中的明度（不會太淺）
  if (c === 0) return 'hsl(0, 0%, 60%)'

  const intensity = Math.min(1, Math.abs(c) / 20) // 範圍 0..1
  const saturation = Math.round(40 + intensity * 40) // 飽和度範圍 40%..80%
  const lightness = Math.round(58 - intensity * 18) // 明度範圍 58%..40%（變動越強明度越暗）

  if (c > 0) {
    // 正向：綠色色相（120）
    return `hsl(120, ${saturation}%, ${lightness}%)`
  }
  // 負向：紅色色相（0）
  return `hsl(0, ${saturation}%, ${lightness}%)`
}

export default function Treemap({ data = [], width = 1000, height = 600, padding = 2, maxRatio = 1.5, valueExponent = 1, capEnabled = false, capPercentile = 99, scaleMode = 'linear', layoutMode = 'treemap', gridDesired = 24, topPercentile = 0, topExtraCells = 0, gridAllocExponent = 1, sectorHeaderHeight = 16, tileStrokeColor = '#000', tileHoverStrokeColor = '#0b63ff', tileHoverStrokeWidth = 1.6, groupOutlineColor = '#000000', groupHeaderColor = '#000000', tileTextColor = '#fff', headerTextColor = '#fff', groupCornerRadius = 4, groupOutlineInset = 1, groupOutlineWidth = 1, onSelectSymbol = () => {}, externalCandleRequest = null}) {
  // data: 陣列，格式範例 { symbol, marketCap, changePercent }
  const containerRef = useRef(null)
  const resizeTimeout = useRef(null)
  const [size, setSize] = useState({ width, height })
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, name: '', pct: '', price: null, marketCap: null, volume: null })
  const [hoveredSymbol, setHoveredSymbol] = useState(null)
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [viewMode, setViewMode] = useState('heatmap')
  const [candleSymbol, setCandleSymbol] = useState(null)
  const ZOOM_TOP_ROW_TOLERANCE = 4
  const ZOOM_HEADER_SEAM_MASK = 3

  // 偵錯開關：設為 true 會繪製 clip/inner 偵錯矩形並輸出 console 日誌
  const showDebug = false

  useEffect(() => {
    if (showDebug) console.log('Treemap props', { groupOutlineInset, groupOutlineWidth, sectorHeaderHeight })
  }, [groupOutlineInset, groupOutlineWidth, sectorHeaderHeight])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      const w = Math.max(100, Math.floor(r.width))
      // 優先使用實際高度（若提供），否則維持原始長寬比
      const h = r.height && r.height >= 50 ? Math.max(50, Math.floor(r.height)) : Math.max(50, Math.round((w * height) / width))

      // 防抖處理快速的調整大小事件
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current)
      resizeTimeout.current = setTimeout(() => {
        setSize({ width: w, height: h })
      }, 100)
    })

    obs.observe(el)
    return () => {
      obs.disconnect()
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current)
    }
  }, [width, height])

  const openCandles = (symbol) => {
    if (!symbol) return
    try { onSelectSymbol(symbol) } catch (error) {}
    setTooltip(t => ({ ...t, show: false }))
    setHoveredSymbol(null)
    setCandleSymbol(symbol)
    setViewMode('candles')
  }

  const backToHeatmap = () => {
    setViewMode('heatmap')
  }

  useEffect(() => {
    const requestedSymbol = String(externalCandleRequest?.symbol || '').trim().toUpperCase()
    if (!requestedSymbol) return
    openCandles(requestedSymbol)
  }, [externalCandleRequest])

  const root = useMemo(() => {
    // 使用次方轉換放大較大的值，讓大項目比小項目成長更快
    // 先按類別（如 sector）彙整，再以 symbol 聚合，確保相同類別的股票群聚
    const aggregatedByCategory = (() => {
      const pickSymbol = (d) => {
        const candidates = [d.symbol, d.ticker, d.symbolDisplay, d.displaySymbol, d.shortName, d.name]
        for (const c of candidates) {
          if (c == null) continue
          const s = String(c).trim()
          if (s) return s
        }
        return ''
      }
      // 以 sector 欄位分群；接受不同 API 命名（gicsSector、sector、sectorName）
      const pickCategory = (d) => {
        if (!d) return 'UNCATEGORIZED'
        const candidates = [d.gicsSector, d.sector, d.sectorName, d.gics_sector]
        for (const c of candidates) {
          if (c == null) continue
          const s = String(c).trim()
          if (s) return s
        }
        return 'UNCATEGORIZED'
      }
      // 清理 symbol：轉大寫並移除非英數字元
      const cleanSym = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9\-\^]/g, '')

      const catMap = new Map()
      for (const d of data) {
        const rawSym = pickSymbol(d)
        const sym = cleanSym(rawSym)
        if (!sym) continue
        if (sym === '^GSPC') continue
        const catRaw = pickCategory(d)
        const cat = String(catRaw || 'UNCATEGORIZED').trim() || 'UNCATEGORIZED'

        const marketCap = d.marketCap != null ? Number(d.marketCap) : (d.market_cap != null ? Number(d.market_cap) : null)
        const volume = d.volume != null ? Number(d.volume) : null
        const rawValue = (marketCap && isFinite(marketCap) && marketCap > 0) ? marketCap : ((volume && isFinite(volume) && volume > 0) ? volume : 1)
        const change = d.changePercent != null
          ? Number(d.changePercent)
          : (d.change_percent != null ? Number(d.change_percent) : (d.change != null ? Number(d.change) : 0))

        if (!catMap.has(cat)) catMap.set(cat, new Map())
        const symMap = catMap.get(cat)
        if (!symMap.has(sym)) {
          symMap.set(sym, { symbol: sym, rawValue: rawValue, weightedChange: change * rawValue, raw: d })
        } else {
          const cur = symMap.get(sym)
          cur.rawValue += rawValue
          cur.weightedChange += change * rawValue
          cur.raw = d
        }
      }

      const cats = []
      for (const [cat, symMap] of catMap.entries()) {
        const children = []
        for (const [sym, v] of symMap.entries()) {
          const avgChange = v.rawValue ? (v.weightedChange / v.rawValue) : 0
          children.push({ symbol: sym, rawValue: v.rawValue, avgChange, raw: v.raw })
        }
        cats.push({ category: cat, children })
      }
      return cats
    })()

    // 計算每個 symbol 的縮放值（跨類別平坦化）
    const allSymbols = []
    for (const c of aggregatedByCategory) for (const ch of c.children) allSymbols.push(ch)
    let baseScaled = allSymbols.map(a => {
      const rawValue = Math.max(0, a.rawValue || 0)
      if (scaleMode === 'log') {
        return Math.max(1e-9, Math.log1p(rawValue))
      }
      if (scaleMode === 'logpow') {
        return Math.max(1e-9, Math.pow(Math.log1p(rawValue), Math.max(0.01, valueExponent)))
      }
      if (scaleMode === 'linear') {
        // 線性映射：面積與原始成交量成正比
        return Math.max(1e-9, rawValue)
      }
      // 備選：次方縮放
      return Math.max(1e-9, Math.pow(rawValue, Math.max(0.01, valueExponent)))
    })

    // 可選的百分位數上限，用於抑制極端值（保持版面穩定）
    if (capEnabled && Array.isArray(baseScaled) && baseScaled.length > 0) {
      const pct = Math.max(0, Math.min(100, Number(capPercentile) || 99))
      // 計算百分位數的值
      const sorted = baseScaled.slice().sort((a, b) => a - b)
      const idx = (pct / 100) * (sorted.length - 1)
      const lo = Math.floor(idx)
      const hi = Math.ceil(idx)
      const capValue = lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
      if (isFinite(capValue) && capValue > 0) {
        baseScaled = baseScaled.map(v => Math.min(v, capValue))
      }
    }

    // 將過大的節點拆成多個相等部分，但仍作為原父節點的子項，以便在父區域內群聚。
    // 我們會反覆增加拆分數量，直到所有葉節點的寬高比不超過 maxRatio 或達到上限。
    const splitIntoNested = (children, baseVals, maxRatio, maxParts = 256, maxIter = 40) => {
      const counts = new Array(children.length).fill(1)

      for (let it = 0; it < maxIter; it++) {
        // 建立巢狀結構：每個 child 要麼是葉節點（value），要麼成為具有多個部分的父節點
        const nestedChildren = children.map((c, i) => {
          const n = counts[i]
          if (n <= 1) return { name: c.symbol, value: baseVals[i], __origIndex: i }
          const parts = Array.from({ length: n }).map((_, j) => ({ name: `${c.symbol}__${j}`, value: baseVals[i] / n, originalSymbol: c.symbol, _rawValue: (c.rawValue || 1) / n }))
          return { name: c.symbol, children: parts, __origIndex: i }
        })

        const tmpNested = { name: 'root', children: nestedChildren }
        const htmp = hierarchy(tmpNested).sum(d => d.value)
        // 使用 squarify ratio 1，偏好產生近似方形的 tiles 以利拆分檢查
        treemap().tile(treemapSquarify.ratio(1)).size([size.width, size.height]).padding(0)(htmp)

        // 檢查葉節點是否違反長寬比，若違反則增加該 symbol 的拆分數
        const leaves = htmp.leaves()
        let increased = false
        for (const lf of leaves) {
          const w = Math.max(1, lf.x1 - lf.x0)
          const h = Math.max(1, lf.y1 - lf.y0)
          if (w / h > maxRatio || h / w > maxRatio) {
            // 找到該葉節點在 root 的直接子代（即其所屬的 symbol 祖先）
            const anc = lf.ancestors().find(a => a.depth === 1)
            if (anc) {
              const sym = anc.data.name
              const idx = children.findIndex(c => c.symbol === sym)
              if (idx >= 0 && counts[idx] < maxParts) {
                // 根據違規程度增加拆分數；步進較小以避免產生大量相等的小部分
                const degree = Math.max(w / (h * maxRatio), h / (w * maxRatio))
                const factor = Math.max(2, Math.ceil(degree * 1.1))
                // 僅對嚴重違規情況放大拆分
                const amp = degree > 3 ? 2 : 1
                const newCount = Math.min(maxParts, Math.max(counts[idx] + 1, Math.floor(counts[idx] * factor * amp)))
                if (newCount > counts[idx]) {
                  counts[idx] = newCount
                  increased = true
                }
              }
            }
          }
        }
        if (!increased) break
      }

      // 根據 counts 建立最終的巢狀子項
      const finalNestedChildren = []
      for (let i = 0; i < children.length; i++) {
        const c = children[i]
        const n = counts[i]
        if (n <= 1) {
          finalNestedChildren.push({ name: c.symbol, value: baseVals[i], _rawValue: c.rawValue, change: c.avgChange || 0, raw: c.raw })
        } else {
          const parts = Array.from({ length: n }).map((_, j) => ({ name: `${c.symbol}__${j}`, value: baseVals[i] / n, originalSymbol: c.symbol, _rawValue: (c.rawValue || 1) / n, change: c.avgChange || 0, raw: c.raw }))
          finalNestedChildren.push({ name: c.symbol, children: parts, _rawValue: c.rawValue, change: c.avgChange || 0, raw: c.raw })
        }
      }
      return finalNestedChildren
    }

    // 為了更偏好方形 tiles，採取較積極的拆分策略（允許更多部分與迭代次數）
    // 並依照類別總量降序排序，讓最大類別先被放置（通常於左上）
    aggregatedByCategory.sort((a, b) => {
      const sa = (a.children || []).reduce((s, c) => s + (c.rawValue || 0), 0)
      const sb = (b.children || []).reduce((s, c) => s + (c.rawValue || 0), 0)
      return sb - sa
    })

    // 在每個類別內部拆分，確保相同 symbol 群聚在一起
    const nestedByCategory = aggregatedByCategory.map(cat => {
      // 將類別內的 symbols 依 rawValue 降序排序，讓較大的項目先被配置（通常於左上）
      cat.children.sort((x, y) => (y.rawValue || 0) - (x.rawValue || 0))
      const children = cat.children
      const baseVals = children.map(ch => {
        // 在 allSymbols 中尋找此 symbol 的索引
        const idx = allSymbols.findIndex(a => a.symbol === ch.symbol)
        return idx >= 0 ? baseScaled[idx] : Math.max(1e-9, Math.pow(ch.rawValue || 1, Math.max(0.01, valueExponent)))
      })
      const nestedChildren = splitIntoNested(children, baseVals, Math.max(1, maxRatio), 1024, 80)
      return { name: cat.category, children: nestedChildren }
    })

    // 分兩階段建立布局，以便保留每個類別的 header 與 outline 內縮空間
    // 第 1 階段：根據每個類別的總值計算類別的外框
    const categoryTotals = nestedByCategory.map(cat => {
      const sumVal = (cat.children || []).reduce((s, ch) => {
        if (ch.value != null) return s + ch.value
        if (Array.isArray(ch.children)) return s + ch.children.reduce((ss, p) => ss + (p.value || 0), 0)
        return s
      }, 0)
      return { name: cat.name, total: Math.max(1e-9, sumVal) }
    })

    const selectedTotals = selectedCategory
      ? categoryTotals.filter(c => c.name === selectedCategory)
      : categoryTotals
    const catRootChildren = selectedTotals.length > 0
      ? selectedTotals
      : categoryTotals
    const catRoot = { name: 'root', children: catRootChildren.map(c => ({ name: c.name, value: c.total })) }
    const hcat = hierarchy(catRoot).sum(d => d.value)
    treemap().tile(treemapSquarify.ratio(1)).size([size.width, size.height]).padding(0)(hcat)

    // 第 2 階段：對每個類別，在保留 header 與 outline 的內縮區域內計算內部的 treemap
    const symbolBoxes = new Map()
    const categoryBoxes = new Map()

    for (const cnode of hcat.children || []) {
      const catName = cnode.data.name
      const boxX0 = cnode.x0, boxY0 = cnode.y0, boxW = Math.max(0, cnode.x1 - cnode.x0), boxH = Math.max(0, cnode.y1 - cnode.y0)
      const labelH = Number(sectorHeaderHeight) || 16
      const canFloatHeader = boxH > Math.max(labelH * 1.2, 24)
      const isActiveZoomCat = !!selectedCategory && catName === selectedCategory
      // 保留 header 空間：若 header 可以浮動則使用小偏移，否則使用完整標籤高度
      const headerOffset = canFloatHeader ? Math.round(labelH * 0.6) : 0
      const contentTop = isActiveZoomCat ? labelH : (canFloatHeader ? headerOffset : labelH)
      const contentY = boxY0 + contentTop
      const contentH = Math.max(0, boxH - contentTop)

      // 計算內縮距離，考慮設定的 inset 與 outline 的寬度
      const insetConfigured = Math.max(0, Number(groupOutlineInset) || 0)
      const outlineW = Math.max(0, Number(groupOutlineWidth) || 0)
      const strokePad = isActiveZoomCat ? 0 : Math.max(insetConfigured, outlineW)

      const innerX = boxX0 + strokePad
      const innerY = contentY + strokePad
      const innerW = Math.max(0, boxW - strokePad * 2)
      const innerH = Math.max(0, contentH - strokePad * 2)

      // 儲存類別外框資訊以供後續繪製 outline / header
      categoryBoxes.set(catName, { x0: boxX0, y0: boxY0, x1: cnode.x1, y1: cnode.y1 })

      // 找到為此類別準備好的巢狀子項，並在內部區域計算 treemap
      const catPrepared = nestedByCategory.find(nb => nb.name === catName)
      if (!catPrepared || !catPrepared.children || innerW <= 0 || innerH <= 0) continue

      const tmpNested = { name: catPrepared.name, children: catPrepared.children }
      const htmp = hierarchy(tmpNested).sum(d => d.value)
      treemap().tile(treemapSquarify.ratio(1)).size([innerW, innerH]).padding(0)(htmp)

      for (const lf of htmp.leaves()) {
        const localSym = lf.data.originalSymbol || lf.data.name
        const absX0 = innerX + lf.x0
        const absY0 = innerY + lf.y0
        const absX1 = innerX + lf.x1
        const absY1 = innerY + lf.y1
        const existing = symbolBoxes.get(localSym) || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, change: lf.data.change, raw: lf.data.raw, totalRaw: 0, category: catName }
        existing.x0 = Math.min(existing.x0, absX0)
        existing.y0 = Math.min(existing.y0, absY0)
        existing.x1 = Math.max(existing.x1, absX1)
        existing.y1 = Math.max(existing.y1, absY1)
        existing.change = lf.data.change != null ? lf.data.change : existing.change
        existing.raw = lf.data.raw || existing.raw
        existing.totalRaw += lf.data._rawValue || 0
        existing.category = catName
        symbolBoxes.set(localSym, existing)
      }
    }

    // 將計算結果的映射附加到 hcat，供渲染使用
    hcat.__symbolBoxes = symbolBoxes
    hcat.__categoryBoxes = categoryBoxes

    return hcat
  }, [data, size.width, size.height, padding, valueExponent, maxRatio, capEnabled, capPercentile, scaleMode, layoutMode, gridDesired, topPercentile, topExtraCells, gridAllocExponent, selectedCategory, sectorHeaderHeight, groupOutlineInset, groupOutlineWidth])

  const categoryEntries = root ? Array.from((root.__categoryBoxes || new Map()).entries()) : []
  const selectedCategoryBox = selectedCategory ? (root && (root.__categoryBoxes || new Map()).get(selectedCategory)) : null
  const visibleCategoryEntries = selectedCategory
    ? categoryEntries.filter(([cat]) => cat === selectedCategory)
    : categoryEntries

  const projectRect = (x0, y0, x1, y1) => {
    if (!selectedCategoryBox) return { x0, y0, x1, y1 }
    const baseW = Math.max(1e-9, selectedCategoryBox.x1 - selectedCategoryBox.x0)
    const baseH = Math.max(1e-9, selectedCategoryBox.y1 - selectedCategoryBox.y0)
    return {
      x0: ((x0 - selectedCategoryBox.x0) / baseW) * size.width,
      y0: ((y0 - selectedCategoryBox.y0) / baseH) * size.height,
      x1: ((x1 - selectedCategoryBox.x0) / baseW) * size.width,
      y1: ((y1 - selectedCategoryBox.y0) / baseH) * size.height
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {viewMode === 'candles' ? (
        <CandlestickView
          symbol={candleSymbol}
          width={size.width}
          height={size.height}
          onBack={backToHeatmap}
        />
      ) : (
        <>
      <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        <g>
          {/* 每類別的 clipPath 以及分組後的 tile 繪製，避免 tiles 被 header/outline 遮蓋 */}
          <defs>
            {root && visibleCategoryEntries.map(([cat, box], ci) => {
              const pbox = projectRect(box.x0, box.y0, box.x1, box.y1)
              const cw = Math.max(0, pbox.x1 - pbox.x0)
              const ch = Math.max(0, pbox.y1 - pbox.y0)
              const labelH = Number(sectorHeaderHeight) || 16
              const canFloatHeader = ch > Math.max(labelH * 1.2, 24)
              const headerOffset = canFloatHeader ? Math.round(labelH * 0.6) : 0
              const contentTop = selectedCategory ? labelH : (canFloatHeader ? headerOffset : labelH)
              const contentY = pbox.y0 + contentTop
              const contentH = Math.max(0, ch - contentTop)
              const seamOverlap = selectedCategory ? 1 : 0
              // 計算一個內縮值，同時考慮設定的 inset 與 outline 的筆寬
              const insetConfigured = Math.max(0, Number(groupOutlineInset) || 0)
              const outlineW = Math.max(0, Number(groupOutlineWidth) || 0)
              const strokePad = selectedCategory ? 0 : Math.max(insetConfigured, outlineW)
              const clipX = pbox.x0 + strokePad
              const clipY = contentY + strokePad - seamOverlap
              const clipW = Math.max(0, cw - strokePad * 2)
              const clipH = Math.max(0, contentH - strokePad * 2 + seamOverlap)
              return (
                <clipPath id={`catClip${ci}`} key={`clip_${ci}`} clipPathUnits="userSpaceOnUse">
                  <rect x={clipX} y={clipY} width={clipW} height={clipH} />
                </clipPath>
              )
            })}
          </defs>

          {showDebug && root && visibleCategoryEntries.map(([cat, box], ci) => {
            const pbox = projectRect(box.x0, box.y0, box.x1, box.y1)
            const cw = Math.max(0, pbox.x1 - pbox.x0)
            const ch = Math.max(0, pbox.y1 - pbox.y0)
            const labelH = Number(sectorHeaderHeight) || 16
            const canFloatHeader = ch > Math.max(labelH * 1.2, 24)
            const headerOffset = canFloatHeader ? Math.round(labelH * 0.6) : 0
            const contentTop = selectedCategory ? labelH : (canFloatHeader ? headerOffset : labelH)
            const contentY = pbox.y0 + contentTop
            const contentH = Math.max(0, ch - contentTop)
            const seamOverlap = selectedCategory ? 1 : 0
            const insetConfigured = Math.max(0, Number(groupOutlineInset) || 0)
            const outlineW = Math.max(0, Number(groupOutlineWidth) || 0)
            const strokePad = selectedCategory ? 0 : Math.max(insetConfigured, outlineW)
            const clipX = pbox.x0 + strokePad
            const clipY = contentY + strokePad - seamOverlap
            const clipW = Math.max(0, cw - strokePad * 2)
            const clipH = Math.max(0, contentH - strokePad * 2 + seamOverlap)
            return (
              <g key={`debug_${ci}`} pointerEvents="none">
                <rect x={clipX} y={clipY} width={clipW} height={clipH} fill="none" stroke="red" strokeWidth={1} strokeDasharray="4 3" />
                <text x={clipX + 4} y={clipY + 12} fontSize={10} fill="red">pad:{strokePad}</text>
              </g>
            )
          })}

          {root && visibleCategoryEntries.map(([cat, box], ci) => {
            const pbox = projectRect(box.x0, box.y0, box.x1, box.y1)
            const labelH = Number(sectorHeaderHeight) || 16
            const entries = Array.from((root.__symbolBoxes || new Map()).entries()).filter(([s, b]) => b.category === cat)
            if (!entries.length) return null
            return (
              <g key={`tiles_${ci}`} clipPath={`url(#catClip${ci})`}>
                {entries.map(([sym, b], i) => {
                  const pb = projectRect(b.x0, b.y0, b.x1, b.y1)
                  const w = Math.max(0, pb.x1 - pb.x0)
                  const h = Math.max(0, pb.y1 - pb.y0)
                  if (w === 0 || h === 0) return null
                  const showFull = w >= 50 && h >= 36
                  const pad = 6
                  const innerW = Math.max(0, w - pad * 2)
                  const innerH = Math.max(0, h - pad * 2)
                  const titleSize = Math.max(10, Math.min(28, Math.floor(Math.max(6, Math.min(innerW, innerH)) * 0.22)))
                  const pctSize = Math.max(9, Math.min(18, Math.floor(Math.max(6, Math.min(innerW, innerH)) * 0.12)))
                  const smallLetterSize = Math.max(8, Math.floor(Math.max(6, Math.min(innerW, innerH)) * 0.18))
                  const cx = pb.x0 + w / 2
                  const cy = pb.y0 + h / 2
                  const pct = b.change != null && isFinite(Number(b.change)) ? (Number(b.change) > 0 ? `+${Number(b.change).toFixed(2)}%` : `${Number(b.change).toFixed(2)}%`) : ''
                  const handleEnter = (e) => {
                    // 使用視窗座標 (clientX/clientY) 設定 tooltip，避免被父容器 overflow 剪裁
                    const cx = e.clientX + 8
                    const cy = e.clientY + 8
                    setHoveredSymbol(sym)
                    setTooltip({
                      show: true,
                      x: cx,
                      y: cy,
                      name: sym,
                      pct: (b.change != null ? Number(b.change).toFixed(2) + '%' : ''),
                      price: b.raw ? (b.raw.currentPrice ?? b.raw.current_price ?? null) : null,
                      marketCap: b.raw ? (b.raw.marketCap ?? b.raw.market_cap ?? null) : null,
                      volume: b.raw ? (b.raw.volume ?? b.totalRaw) : b.totalRaw
                    })
                  }
                  const handleMove = (e) => {
                    // 更新 tooltip 位置為視窗座標
                    const cx = e.clientX + 8
                    const cy = e.clientY + 8
                    setTooltip(t => ({ ...t, x: cx, y: cy }))
                  }
                  const handleLeave = () => { setHoveredSymbol(null); setTooltip(t => ({ ...t, show: false })) }
                  return (
                    <g
                      key={`${sym}_${i}`}
                      onMouseEnter={handleEnter}
                      onMouseMove={handleMove}
                      onMouseLeave={handleLeave}
                      onClick={() => { try { onSelectSymbol(sym) } catch (e) {} }}
                      onDoubleClick={() => openCandles(sym)}
                      style={{ cursor: 'pointer' }}
                    >
                      {(() => {
                        // 判斷目前 tile 是否被 hover，以決定描邊樣式
                        const isHovered = hoveredSymbol === sym
                        const sWidth = isHovered ? Math.max(2, tileHoverStrokeWidth) : 0.6
                        const strokeColor = isHovered ? tileHoverStrokeColor : tileStrokeColor
                        // 填滿基底（整個 tile 範圍）
                        const fillRect = <rect x={pb.x0} y={pb.y0} width={w} height={h} fill={colorFor(b.change)} stroke="none" />
                        // 以內縮矩形繪製描邊，使描邊呈現在 tile 內側
                        const inset = Math.max(0, sWidth / 2)
                        const strokeRect = (w > sWidth && h > sWidth)
                          ? <rect x={pb.x0 + inset} y={pb.y0 + inset} width={Math.max(0, w - sWidth)} height={Math.max(0, h - sWidth)} fill="none" stroke={strokeColor} strokeWidth={sWidth} />
                          : null
                        return <>{fillRect}{strokeRect}</>
                      })()}
                      {showFull ? (
                        <>
                          <text x={cx} y={cy - (titleSize * 0.15)} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight={800} fontSize={`${titleSize}px`}>{sym}</text>
                          {pct && <text x={cx} y={cy + (titleSize * 0.9)} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={`${pctSize}px`} opacity={0.95}>{pct}</text>}
                        </>
                      ) : (
                        innerW >= 10 && innerH >= 10 ? (
                          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontWeight={700} fontSize={`${smallLetterSize}px`}>{sym.charAt(0)}</text>
                        ) : null
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {root && visibleCategoryEntries.map(([cat, box], ci) => {
            const pbox = projectRect(box.x0, box.y0, box.x1, box.y1)
            const cw = Math.max(0, pbox.x1 - pbox.x0)
            const ch = Math.max(0, pbox.y1 - pbox.y0)
            if (cw === 0 || ch === 0) return null
            const labelH = Number(sectorHeaderHeight) || 16
            const headerFontSize = Math.max(10, Math.min(18, Math.floor(labelH * 0.55)))
            const labelY = Math.round(labelH / 2)
            const labelText = String(cat || 'UNCATEGORIZED')
            const isSelectedCategory = selectedCategory === cat
            const handleSelectCategory = () => {
              if (!selectedCategory) setSelectedCategory(cat)
            }
            const handleBackCategory = (e) => {
              e.stopPropagation()
              setSelectedCategory(null)
            }
            const handleHeaderClick = (e) => {
              if (isSelectedCategory) {
                handleBackCategory(e)
              } else {
                handleSelectCategory()
              }
            }

            // 判斷是否因 tile hover 或 header/outline hover 而使此類別為活動狀態
            const hoveredBox = root.__symbolBoxes && root.__symbolBoxes.get(hoveredSymbol)
            const isCatHovered = (hoveredBox && hoveredBox.category === cat) || (hoveredCategory === cat)
            const isHeaderOrOutlineHovered = hoveredCategory === cat
            const activeOutlineColor = selectedCategory
              ? (isHeaderOrOutlineHovered ? tileHoverStrokeColor : groupOutlineColor)
              : (isCatHovered ? tileHoverStrokeColor : groupOutlineColor)
            const activeHeaderColor = selectedCategory
              ? (isHeaderOrOutlineHovered ? tileHoverStrokeColor : groupHeaderColor)
              : (isCatHovered ? tileHoverStrokeColor : groupHeaderColor)

            // 若垂直空間足夠，將 header 畫成浮動帶置於群組外框之上，以符合設計參考
            const canFloatHeader = ch > Math.max(labelH * 1.2, 24)
            const headerOffset = canFloatHeader ? Math.round(labelH * 0.6) : 0
            const outlineY = headerOffset
            const outlineH = Math.max(0, ch - outlineY)
            const blue = '#000'

            if (canFloatHeader) {
              const sw = Math.max(0, Number(groupOutlineWidth) || 0)
              const insetConfiguredLocal = Math.max(0, Number(groupOutlineInset) || 0)
              const strokePadLocal = Math.max(insetConfiguredLocal, sw)
              // 使用 prop 指定的圓角，但限制成不超過群組最小邊長的一半
              const desiredRx = Number(groupCornerRadius) || 0
              const rx = Math.max(0, Math.min(desiredRx, Math.floor(Math.min(cw, ch) * 0.5)))
              // header 子路徑（上方為圓角）
              const headerPath = `M ${rx} 0 H ${Math.max(rx, cw - rx)} A ${rx} ${rx} 0 0 1 ${cw} ${rx} V ${labelH} H 0 V ${rx} A ${rx} ${rx} 0 0 1 ${rx} 0 Z`
              // 外層圓角矩形路徑
              const outerPath = `M ${rx} ${outlineY} H ${Math.max(rx, cw - rx)} A ${rx} ${rx} 0 0 1 ${cw} ${outlineY + rx} V ${outlineY + Math.max(0, outlineH - rx)} A ${rx} ${rx} 0 0 1 ${Math.max(rx, cw - rx)} ${outlineY + outlineH} H ${rx} A ${rx} ${rx} 0 0 1 0 ${outlineY + Math.max(0, outlineH - rx)} V ${outlineY + rx} A ${rx} ${rx} 0 0 1 ${rx} ${outlineY} Z`
              // 內部要挖空的方形區域（以 strokePadLocal 做為內縮），會產生內部直角
              const insetX = strokePadLocal
              const insetY = outlineY + strokePadLocal
              const innerW = Math.max(0, cw - strokePadLocal * 2)
              const innerH = Math.max(0, outlineH - strokePadLocal * 2)
              const innerRectPath = `M ${insetX} ${insetY} H ${insetX + innerW} V ${insetY + innerH} H ${insetX} Z`
              const combined = innerW > 0 && innerH > 0 ? (outerPath + ' ' + innerRectPath) : outerPath
              return (
                <g key={`cat_${ci}`} transform={`translate(${pbox.x0},${pbox.y0})`}>
                  {/* 放大模式使用描邊矩形，避免 header 下方出現填色帶；一般模式維持環形 */}
                  {isSelectedCategory ? (
                    <>
                      <line
                        x1={sw / 2}
                        y1={labelH + sw / 2}
                        x2={Math.max(sw / 2, cw - sw / 2)}
                        y2={labelH + sw / 2}
                        stroke={activeOutlineColor}
                        strokeWidth={sw}
                        pointerEvents="auto"
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={handleSelectCategory}
                      />
                      <line
                        x1={sw / 2}
                        y1={labelH}
                        x2={sw / 2}
                        y2={Math.max(labelH, ch - sw / 2)}
                        stroke={activeOutlineColor}
                        strokeWidth={sw}
                        pointerEvents="auto"
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={handleSelectCategory}
                      />
                      <line
                        x1={Math.max(sw / 2, cw - sw / 2)}
                        y1={labelH}
                        x2={Math.max(sw / 2, cw - sw / 2)}
                        y2={Math.max(labelH, ch - sw / 2)}
                        stroke={activeOutlineColor}
                        strokeWidth={sw}
                        pointerEvents="auto"
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={handleSelectCategory}
                      />
                      <line
                        x1={sw / 2}
                        y1={Math.max(labelH, ch - sw / 2)}
                        x2={Math.max(sw / 2, cw - sw / 2)}
                        y2={Math.max(labelH, ch - sw / 2)}
                        stroke={activeOutlineColor}
                        strokeWidth={sw}
                        pointerEvents="auto"
                        onMouseEnter={() => setHoveredCategory(cat)}
                        onMouseLeave={() => setHoveredCategory(null)}
                        onClick={handleSelectCategory}
                      />
                    </>
                  ) : (
                    <path d={combined} fill={activeOutlineColor} fillRule="evenodd" pointerEvents="auto" onMouseEnter={() => setHoveredCategory(cat)} onMouseLeave={() => setHoveredCategory(null)} onClick={handleSelectCategory} />
                  )}
                  {/* 繪製置於上方的 header 區塊 */}
                  <path d={headerPath} fill={activeHeaderColor} pointerEvents="auto" onMouseEnter={() => setHoveredCategory(cat)} onMouseLeave={() => setHoveredCategory(null)} onClick={handleHeaderClick} />
                  {isSelectedCategory && (
                    <rect
                      x={0}
                      y={Math.max(0, labelH - 1)}
                      width={cw}
                      height={ZOOM_HEADER_SEAM_MASK}
                      fill={activeHeaderColor}
                      pointerEvents="none"
                    />
                  )}
                  <text x={12} y={labelY} fill={headerTextColor} fontSize={`${headerFontSize}px`} fontWeight={800} opacity={0.98} pointerEvents="none" dominantBaseline="middle">{labelText}</text>
                  {isSelectedCategory ? (
                    <text x={Math.max(12, cw - 12)} y={labelY} textAnchor="end" fill={headerTextColor} fontSize={`${Math.max(11, Math.floor(labelH * 0.58))}px`} fontWeight={800} opacity={0.98} pointerEvents="none" dominantBaseline="middle">← Back</text>
                  ) : (
                    <text x={Math.max(12, cw - 22)} y={labelY} fill={headerTextColor} fontSize={`${Math.max(12, Math.floor(labelH * 0.6))}px`} fontWeight={800} opacity={0.98} pointerEvents="none" dominantBaseline="middle">›</text>
                  )}
                </g>
              )
            }

            // 替代顯示：在非常小的群組中，將 header 繪製於盒內
            // fallback 的 rx 使用相同的設定圓角，但會限制成不超過群組最小邊長的一半
            const desiredRxFallback = Number(groupCornerRadius) || 0
            const rxFallback = Math.max(0, Math.min(desiredRxFallback, Math.floor(Math.min(cw, ch) * 0.5)))
            return (
              <g key={`cat_${ci}`} transform={`translate(${pbox.x0},${pbox.y0})`}>
                {/* 外框為圓角，但內部裁切維持方角（由 clipPath 的內縮決定） */}
                <rect width={cw} height={ch} fill={'none'} stroke={activeOutlineColor} strokeWidth={Math.max(0, Number(groupOutlineWidth) || 2.4)} rx={rxFallback} pointerEvents="auto" onMouseEnter={() => setHoveredCategory(cat)} onMouseLeave={() => setHoveredCategory(null)} onClick={handleSelectCategory} />
                <rect x={0} y={0} width={cw} height={labelH} fill={activeHeaderColor} rx={rxFallback} ry={rxFallback} pointerEvents="auto" onMouseEnter={() => setHoveredCategory(cat)} onMouseLeave={() => setHoveredCategory(null)} onClick={handleHeaderClick} />
                <text x={8} y={labelY} fill={headerTextColor} fontSize={`${headerFontSize}px`} fontWeight={800} opacity={0.95} pointerEvents="none" dominantBaseline="middle">{labelText}</text>
                {isSelectedCategory && (
                  <text x={Math.max(12, cw - 12)} y={labelY} textAnchor="end" fill={headerTextColor} fontSize={`${Math.max(11, Math.floor(labelH * 0.58))}px`} fontWeight={800} opacity={0.98} pointerEvents="none" dominantBaseline="middle">← Back</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      {tooltip.show && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '6px 8px',
          borderRadius: 6,
          pointerEvents: 'none',
          fontSize: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          maxWidth: 320,
          zIndex: 10000
        }}>
          <div style={{ fontWeight: 700 }}>{tooltip.name}</div>
          <div>{tooltip.pct}</div>
          {tooltip.price != null && <div>Price: {tooltip.price}</div>}
          {tooltip.marketCap != null && <div>MCap: {Number(tooltip.marketCap).toLocaleString()}</div>}
          {tooltip.volume != null && <div>Vol: {tooltip.volume}</div>}
        </div>
      )}
        </>
      )}
    </div>
  )
}
