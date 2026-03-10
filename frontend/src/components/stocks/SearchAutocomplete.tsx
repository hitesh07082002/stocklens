import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"

import { useStockSearch } from "../../api/stocks"
import { Input } from "../ui/Input"


function sanitizeQuery(value: string) {
  return value.replace(/[^A-Za-z0-9\s.-]/g, "").trim()
}

export function SearchAutocomplete() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const deferredQuery = useDeferredValue(query)
  const searchQuery = useStockSearch(debouncedQuery)
  const results = searchQuery.data?.results ?? []

  useEffect(() => {
    const sanitized = sanitizeQuery(deferredQuery)
    if (!sanitized) {
      setDebouncedQuery("")
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }

    const timer = window.setTimeout(() => {
      setDebouncedQuery(sanitized)
      setIsOpen(true)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [deferredQuery])

  useEffect(() => {
    if (!results.length) {
      setActiveIndex(-1)
      return
    }

    setActiveIndex(0)
  }, [results.length])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  function navigateToStock(symbol: string) {
    navigate(`/stocks/${symbol}`)
    setQuery("")
    setDebouncedQuery("")
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      return
    }

    if (event.key === "Escape") {
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((currentIndex) => {
        if (!results.length) {
          return -1
        }
        return currentIndex >= results.length - 1 ? 0 : currentIndex + 1
      })
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((currentIndex) => {
        if (!results.length) {
          return -1
        }
        return currentIndex <= 0 ? results.length - 1 : currentIndex - 1
      })
      return
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      navigateToStock(results[activeIndex].symbol)
    }
  }

  function renderResults() {
    if (searchQuery.isFetching) {
      return <p className="px-4 py-4 text-sm text-muted dark:text-slate-300">Searching…</p>
    }

    if (searchQuery.isError) {
      return <p className="px-4 py-4 text-sm text-rose-600 dark:text-rose-300">Search unavailable</p>
    }

    if (!results.length) {
      return (
        <p className="px-4 py-4 text-sm text-muted dark:text-slate-300">
          No stocks found for &quot;{debouncedQuery}&quot;
        </p>
      )
    }

    return (
      <ul className="divide-y divide-border/60">
        {results.map((result, index) => {
          const isActive = index === activeIndex
          return (
            <li key={`${result.symbol}-${result.exchange}`}>
              <button
                className={`flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition ${
                  isActive
                    ? "bg-amber-50 text-ink dark:bg-slate-900 dark:text-slate-50"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateToStock(result.symbol)}
                type="button"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink dark:text-slate-50">
                    {result.symbol} <span className="font-normal text-muted dark:text-slate-300">{result.name}</span>
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted dark:text-slate-400">
                    {result.exchange || "US"} {result.sector ? `• ${result.sector}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted dark:text-slate-400">
                  {searchQuery.data?.source ?? "local"}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="relative flex-1 lg:max-w-md" ref={containerRef}>
      <Input
        aria-label="Global stock search"
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(Boolean(event.target.value.trim()))
        }}
        onFocus={() => setIsOpen(Boolean(query.trim()))}
        onKeyDown={handleKeyDown}
        placeholder="Search AAPL, Apple, Microsoft..."
        type="search"
        value={query}
      />

      {isOpen && debouncedQuery ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] overflow-hidden rounded-[24px] border border-border bg-white/95 shadow-panel backdrop-blur dark:bg-slate-950/95">
          {renderResults()}
        </div>
      ) : null}
    </div>
  )
}
