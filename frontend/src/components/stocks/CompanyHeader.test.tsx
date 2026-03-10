import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { StockProfile } from "../../types/stock"
import { CompanyHeader } from "./CompanyHeader"


const baseProfile: StockProfile = {
  symbol: "AAPL",
  name: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  exchange: "NASDAQ",
  description: "Apple designs and sells devices, software, and services.",
  ceo: "Tim Cook",
  website: "https://www.apple.com",
  market_cap: 3200000000000,
  last_price: "185.5000",
  price_change: "2.1500",
  price_change_pct: "0.0117",
  is_sp500: true,
  updated_at: "2026-03-10T12:00:00Z",
}

describe("CompanyHeader", () => {
  it("renders the formatted Week 2 company snapshot", () => {
    render(<CompanyHeader profile={baseProfile} />)

    expect(screen.getByText("NASDAQ")).toBeInTheDocument()
    expect(screen.getByText(/S&P 500/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Apple Inc\./i })).toBeInTheDocument()
    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("Technology")).toBeInTheDocument()
    expect(screen.getByText("Consumer Electronics")).toBeInTheDocument()
    expect(screen.getByText("Tim Cook")).toBeInTheDocument()
    expect(screen.getByText("$185.50")).toBeInTheDocument()
    expect(screen.getByText("+$2.15")).toBeInTheDocument()
    expect(screen.getByText("1.17%")).toBeInTheDocument()
    expect(screen.getByText("$3.2T")).toBeInTheDocument()
    expect(screen.getByText("Mar 10, 2026")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "https://www.apple.com" })).toHaveAttribute(
      "href",
      "https://www.apple.com",
    )
  })

  it("renders fallbacks for incomplete cached profiles", () => {
    render(
      <CompanyHeader
        profile={{
          ...baseProfile,
          sector: "",
          industry: "",
          description: "",
          website: "",
          ceo: "",
          market_cap: null,
          last_price: null,
          price_change: null,
          price_change_pct: null,
          is_sp500: false,
        }}
      />,
    )

    expect(screen.queryByText(/S&P 500/i)).not.toBeInTheDocument()
    expect(screen.getByText("Sector pending")).toBeInTheDocument()
    expect(screen.getByText("Industry pending")).toBeInTheDocument()
    expect(
      screen.getByText(/Profile description will populate as soon as the stock is cached through the backend\./i),
    ).toBeInTheDocument()
    expect(screen.getByText("Not available")).toBeInTheDocument()
    expect(screen.getAllByText("N/A")).toHaveLength(4)
  })
})
