import { AreaSeries, createChart, type Time } from "lightweight-charts"
import { useEffect, useRef } from "react"

import { useUiStore } from "../../store/uiStore"
import type { PricePoint } from "../../types/stock"
import { Button } from "../ui/Button"


interface PriceChartProps {
  prices: PricePoint[]
  range: "1y" | "3y" | "5y"
  onRangeChange: (range: "1y" | "3y" | "5y") => void
}

const ranges: Array<"1y" | "3y" | "5y"> = ["1y", "3y", "5y"]

export function PriceChart({ prices, range, onRangeChange }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const theme = useUiStore((state) => state.theme)

  useEffect(() => {
    if (!containerRef.current || !prices.length) {
      return
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 360,
      layout: {
        background: { color: theme === "dark" ? "#0f172a" : "#fffdf8" },
        textColor: theme === "dark" ? "#cbd5e1" : "#334155",
      },
      grid: {
        vertLines: { color: theme === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.18)" },
        horzLines: { color: theme === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.18)" },
      },
      rightPriceScale: {
        borderColor: theme === "dark" ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.24)",
      },
      timeScale: {
        borderColor: theme === "dark" ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.24)",
      },
      crosshair: {
        vertLine: { color: "#f59e0b", width: 1 },
        horzLine: { color: "#f59e0b", width: 1 },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#f59e0b",
      topColor: "rgba(245, 158, 11, 0.28)",
      bottomColor: "rgba(245, 158, 11, 0.03)",
      priceLineVisible: false,
      lastValueVisible: true,
    })

    series.setData(
      [...prices].reverse().map((price) => ({
        time: price.date as Time,
        value: Number.parseFloat(price.close),
      })),
    )
    chart.timeScale().fitContent()

    return () => chart.remove()
  }, [prices, theme])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted dark:text-slate-300">EOD close prices cached through the Django stock proxy.</p>
        <div className="flex flex-wrap gap-2">
          {ranges.map((option) => (
            <Button
              className={range === option ? "" : "opacity-80"}
              key={option}
              onClick={() => onRangeChange(option)}
              variant={range === option ? "primary" : "secondary"}
            >
              {option.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {prices.length ? (
        <div className="overflow-hidden rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(255,251,235,0.85),rgba(255,255,255,0.98))] p-3 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
          <div className="h-[360px]" ref={containerRef} />
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-border px-6 py-16 text-center text-sm text-muted dark:text-slate-300">
          No price data is available for this range yet.
        </div>
      )}
    </div>
  )
}
