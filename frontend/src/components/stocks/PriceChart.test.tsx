import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createChart } from "lightweight-charts"
import { describe, expect, it, vi } from "vitest"

import type { PricePoint } from "../../types/stock"
import { PriceChart } from "./PriceChart"


const prices: PricePoint[] = [
  { date: "2026-03-10", close: "185.5000", volume: 52340100 },
  { date: "2026-03-09", close: "183.2500", volume: 48920000 },
]

describe("PriceChart", () => {
  it("hydrates the lightweight chart with reversed numeric data", () => {
    const { unmount } = render(<PriceChart onRangeChange={vi.fn()} prices={prices} range="1y" />)

    const chartFactory = vi.mocked(createChart)
    expect(chartFactory).toHaveBeenCalledTimes(1)

    const chart = chartFactory.mock.results[0]?.value as {
      addSeries: ReturnType<typeof vi.fn>
      timeScale: ReturnType<typeof vi.fn>
      remove: ReturnType<typeof vi.fn>
    }
    const series = chart.addSeries.mock.results[0]?.value as {
      setData: ReturnType<typeof vi.fn>
    }
    const timeScale = chart.timeScale.mock.results[0]?.value as {
      fitContent: ReturnType<typeof vi.fn>
    }

    expect(chart.addSeries).toHaveBeenCalledTimes(1)
    expect(series.setData).toHaveBeenCalledWith([
      { time: "2026-03-09", value: 183.25 },
      { time: "2026-03-10", value: 185.5 },
    ])
    expect(chart.timeScale).toHaveBeenCalledTimes(1)
    expect(timeScale.fitContent).toHaveBeenCalledTimes(1)

    unmount()

    expect(chart.remove).toHaveBeenCalledTimes(1)
  })

  it("notifies the parent when the range changes", async () => {
    const onRangeChange = vi.fn()
    const user = userEvent.setup()
    render(<PriceChart onRangeChange={onRangeChange} prices={prices} range="1y" />)

    await user.click(screen.getByRole("button", { name: "3Y" }))
    await user.click(screen.getByRole("button", { name: "5Y" }))

    expect(onRangeChange).toHaveBeenNthCalledWith(1, "3y")
    expect(onRangeChange).toHaveBeenNthCalledWith(2, "5y")
  })

  it("shows the empty state when no prices are available", () => {
    render(<PriceChart onRangeChange={vi.fn()} prices={[]} range="1y" />)

    expect(screen.getByText(/No price data is available for this range yet\./i)).toBeInTheDocument()
    expect(vi.mocked(createChart)).not.toHaveBeenCalled()
  })
})
