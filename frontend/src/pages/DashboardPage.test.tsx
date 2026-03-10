import { QueryClient } from "@tanstack/react-query"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { server } from "../mocks/server"
import { renderWithProviders } from "../test/test-utils"
import { DashboardPage } from "./DashboardPage"


function createNoRetryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        refetchOnWindowFocus: false,
        staleTime: 0,
      },
    },
  })
}

function renderDashboard(symbol = "AAPL", queryClient?: QueryClient) {
  return renderWithProviders(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[`/stocks/${symbol}`]}
    >
      <Routes>
        <Route path="/stocks/:symbol" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
    queryClient,
  )
}

describe("DashboardPage", () => {
  it("renders the live Week 2 profile and chart states", async () => {
    renderDashboard()

    expect(screen.getByRole("heading", { name: /AAPL stock dashboard/i })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: /Apple Inc\./i })).toBeInTheDocument()
    expect(screen.getByText(/Current EOD Price/i)).toBeInTheDocument()
    expect(screen.getByText(/\$185\.50/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Price history/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "1Y" })).toBeInTheDocument()
    expect(screen.getByText(/Financials stays intentionally deferred\./i)).toBeInTheDocument()
  })

  it("shows a not-found state when the profile request returns 404", async () => {
    server.use(
      http.get("*/api/v1/stocks/ZZZZ/", () => HttpResponse.json({ detail: "Stock 'ZZZZ' not found." }, { status: 404 })),
    )

    renderDashboard("ZZZZ", createNoRetryQueryClient())

    expect(await screen.findByRole("heading", { name: /Stock not found/i })).toBeInTheDocument()
    expect(screen.getByText(/We could not find ZZZZ/i)).toBeInTheDocument()
  })

  it("shows an upstream error state when the profile request fails", async () => {
    server.use(
      http.get("*/api/v1/stocks/AAPL/", () => HttpResponse.json({ detail: "upstream failure" }, { status: 502 })),
    )

    renderDashboard("AAPL", createNoRetryQueryClient())

    expect(await screen.findByRole("heading", { name: /Upstream data unavailable/i })).toBeInTheDocument()
    expect(screen.getByText(/The profile request for AAPL failed during the synchronous cache-through fetch/i)).toBeInTheDocument()
  })

  it("shows a price-level error state when price history fails but profile succeeds", async () => {
    server.use(
      http.get("*/api/v1/stocks/AAPL/prices/", () =>
        HttpResponse.json({ detail: "upstream failure" }, { status: 502 }),
      ),
    )

    renderDashboard("AAPL", createNoRetryQueryClient())

    expect(await screen.findByRole("heading", { name: /Apple Inc\./i })).toBeInTheDocument()
    expect(await screen.findByText(/Price data is unavailable right now/i)).toBeInTheDocument()
  })

  it("refetches prices when the range toggle changes", async () => {
    const requestedRanges: string[] = []
    server.use(
      http.get("*/api/v1/stocks/AAPL/prices/", ({ request }) => {
        const url = new URL(request.url, "http://localhost:8000")
        const range = url.searchParams.get("range") ?? "1y"
        requestedRanges.push(range)

        return HttpResponse.json({
          symbol: "AAPL",
          range,
          prices: [
            { date: "2026-03-10", close: "185.5000", volume: 52340100 },
            { date: "2026-03-09", close: "183.2500", volume: 48920000 },
          ],
          count: 2,
        })
      }),
    )

    const user = userEvent.setup()
    renderDashboard()

    expect(await screen.findByRole("heading", { name: /Apple Inc\./i })).toBeInTheDocument()
    await waitFor(() => expect(requestedRanges.at(-1)).toBe("1y"))

    await user.click(screen.getByRole("button", { name: "3Y" }))

    await waitFor(() => expect(requestedRanges.at(-1)).toBe("3y"))
  })
})
