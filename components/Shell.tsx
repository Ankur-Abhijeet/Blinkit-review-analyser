'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import DemoToggle from './DemoToggle'

interface ShellProps {
  children: React.ReactNode
}

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved) {
      setTimeout(() => setTheme(saved), 0)
      document.documentElement.classList.toggle('dark', saved === 'dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const defaultTheme = prefersDark ? 'dark' : 'light'
      setTimeout(() => setTheme(defaultTheme), 0)
      document.documentElement.classList.toggle('dark', defaultTheme === 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const isLinkActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar Navigation */}
      <aside className="no-print hidden md:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-colors duration-200">
        {/* Brand logo header */}
        <div className="flex items-center h-16 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight bg-gradient-to-r from-[#006b5c] to-[#005045] dark:from-[#55dbc4] dark:to-[#005045] bg-clip-text text-transparent">
            🔍 ReviewLens
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              isLinkActive('/')
                ? 'bg-[#cce8e2] text-[#00201a] dark:bg-[#005045] dark:text-[#76f8e0]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            📊 New Analysis
          </Link>
          <Link
            href="/history"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              isLinkActive('/history')
                ? 'bg-[#cce8e2] text-[#00201a] dark:bg-[#005045] dark:text-[#76f8e0]'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            📁 Historical Runs
          </Link>
        </nav>

        {/* Footer controls inside sidebar */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <DemoToggle />
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150"
          >
            <span>Theme</span>
            <span>{theme === 'light' ? '🌙 Dark' : '☀️ Light'}</span>
          </button>
          <div className="text-[11px] text-zinc-400 text-center">
            ReviewLens v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="no-print flex md:hidden items-center justify-between h-16 px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/" className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">
            🔍 ReviewLens
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/history"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Archive
            </Link>
            <button
              onClick={toggleTheme}
              className="text-sm p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>

        {/* Screen/Page body */}
        <main className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
