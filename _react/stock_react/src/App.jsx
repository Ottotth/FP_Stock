import React, { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

export default function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchHeatmap() {
      setLoading(true)
      try {
        const res = await axios.get('/heatMapData') // call backend endpoint
        console.log('heatMapData response:', res)
        let payload = res && res.data
        if (!Array.isArray(payload)) {
          if (payload && Array.isArray(payload.data)) {
            payload = payload.data
          } else if (payload && Array.isArray(payload.heatMapData)) {
            payload = payload.heatMapData
          } else {
            console.warn('Unexpected /heatMapData payload shape, using empty array', payload)
            payload = []
          }
        }
        setData(payload)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchHeatmap()
  }, [])

  return (
    <div className="app">
      <header>
        <h1>FP Stock — HeatMap</h1>
      </header>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="list">
          {(!Array.isArray(data) || data.length === 0) ? (
            <p>No data</p>
          ) : (
            <ul>
              {data.map((item) => (
                <li key={item.symbol}>
                  <strong>{item.symbol}</strong>: {item.currentPrice} ({item.changePercent}%)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
