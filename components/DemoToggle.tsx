'use client'

import React, { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function DemoToggle() {
  const [isMock, setIsMock] = useState(true)

  useEffect(() => {
    // Read MOCK_LLM cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }

    const mockCookie = getCookie('MOCK_LLM')
    if (mockCookie !== null) {
      const val = mockCookie === 'true'
      setTimeout(() => setIsMock(val), 0)
    } else {
      // Check config endpoint
      apiFetch('/api/classify/config')
        .then((res) => res.json())
        .then((data) => {
          setIsMock(data.isMock)
          document.cookie = `MOCK_LLM=${data.isMock}; path=/; max-age=31536000`
        })
        .catch(() => {})
    }
  }, [])

  const handleToggle = () => {
    const nextVal = !isMock
    setIsMock(nextVal)
    document.cookie = `MOCK_LLM=${nextVal}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <div className="no-print p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">LLM Mode</h4>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {isMock ? 'Offline Mock Simulation' : 'Live Groq Llama API'}
          </span>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            isMock ? 'bg-[#006b5c] dark:bg-[#55dbc4]' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isMock ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {isMock && (
        <div className="demo-badge p-2.5 rounded-lg border border-[#ba1a1a]/30 bg-[#ffdad6] text-[#410002] dark:bg-[#93000a]/30 dark:text-[#ffdad6] dark:border-[#ffb4ab]/20 text-[10px] leading-relaxed font-semibold">
          ⚠️ Mock Mode Enabled: LLM processing is simulated. To connect live providers, toggle above and configure LLM_API_KEY.
        </div>
      )}
    </div>
  )
}
export function DemoBadge({ forceShow = false }: { forceShow?: boolean }) {
  const [show, setShow] = useState(forceShow)

  useEffect(() => {
    if (forceShow) return
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }
    const val = getCookie('MOCK_LLM') === 'true'
    setTimeout(() => setShow(val), 0)
  }, [forceShow])

  if (!show) return null

  return (
    <div className="demo-badge px-4 py-2 border-b-2 border-[#ba1a1a] bg-[#ffdad6] text-[#410002] text-xs font-bold text-center w-full shadow-sm z-50">
      ⚠️ DEMO RUN: Curations, classifications, and opportunity sizing are processed using offline heuristics.
    </div>
  )
}
