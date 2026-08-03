'use client'

import React, { useState } from 'react'
import { apiFetch } from '../lib/api'

interface AssistantProps {
  runId: string
  datasetName?: string
  reviewCount?: number
}

export const Assistant: React.FC<AssistantProps> = ({ runId, datasetName = 'Active Run Corpus', reviewCount = 0 }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; citations?: string[] }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const suggestedPrompts = [
    'What are the top 3 barriers to fresh produce trial?',
    'Why do users rely on search rather than browsing categories?',
    'What information gaps prevent gourmet food trial?',
  ]

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input
    if (!query.trim() || loading) return

    const newMessages = [...messages, { sender: 'user' as const, text: query }]
    setMessages(newMessages)
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, message: query }),
      })

      if (!res.ok) {
        throw new Error('Failed to get chat response.')
      }

      const data = await res.json()
      setMessages([...newMessages, { sender: 'assistant', text: data.reply, citations: data.citations }])
    } catch (err: unknown) {
      setMessages([
        ...newMessages,
        { sender: 'assistant', text: 'Sorry, an error occurred while processing your request.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-[#006b5c] hover:bg-[#005045] text-white font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 border border-teal-400/30 backdrop-blur-md transition-all hover:scale-105"
      >
        <span>💬 Grounded PM Assistant</span>
        <span className="bg-teal-300 text-slate-950 px-2 py-0.5 rounded-full text-[10px]">{reviewCount} in context</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[540px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
        <div>
          <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
            <span>💬 Grounded Research Assistant</span>
          </h4>
          <p className="text-[10px] text-slate-400 truncate max-w-[240px]">
            Scope: {datasetName} ({reviewCount} reviews)
          </p>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white text-sm font-bold">
          ✕
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        {messages.length === 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-[11px] text-slate-400 text-center italic">
              Ask any research question grounded strictly in this run's classified evidence. All answers cite exact review IDs.
            </p>
            <div className="space-y-1.5 pt-2">
              <span className="block text-[10px] font-bold text-teal-400 uppercase">Suggested Prompts:</span>
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] border border-slate-800 transition-colors"
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`p-3 rounded-xl max-w-[85%] text-[11px] ${
                m.sender === 'user'
                  ? 'bg-teal-600 text-white rounded-br-none'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
              }`}
            >
              {m.text}
            </div>

            {m.citations && m.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.citations.map((c) => (
                  <span key={c} className="text-[9px] font-mono bg-teal-500/10 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/20">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && <div className="text-slate-400 text-[10px] animate-pulse">Assistant analyzing review corpus...</div>}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2"
      >
        <input
          type="text"
          placeholder="Ask a grounded research question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
