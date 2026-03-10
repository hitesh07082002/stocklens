export interface StockSearchResult {
  symbol: string
  name: string
  exchange: string
  sector: string
}

export interface StockSearchResponse {
  results: StockSearchResult[]
  count: number
  source: "local" | "fmp"
}

export interface StockProfile {
  symbol: string
  name: string
  sector: string
  industry: string
  exchange: string
  description: string
  ceo: string
  website: string
  market_cap: number | null
  last_price: string | null
  price_change: string | null
  price_change_pct: string | null
  is_sp500: boolean
  updated_at: string
}

export interface PricePoint {
  date: string
  close: string
  volume: number
}

export interface StockPricesResponse {
  symbol: string
  range: "1y" | "3y" | "5y"
  prices: PricePoint[]
  count: number
}
