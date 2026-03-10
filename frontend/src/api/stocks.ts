import { useQuery } from "@tanstack/react-query"

import { authlessClient } from "./client"
import type { StockPricesResponse, StockProfile, StockSearchResponse } from "../types/stock"


const MINUTE = 1000 * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const MAX_BROWSER_TIMEOUT_MS = 2_147_483_000


export async function getStockProfile(symbol: string) {
  const response = await authlessClient.get<StockProfile>(`/api/v1/stocks/${symbol}/`)
  return response.data
}

export async function getStockPrices(symbol: string, range: "1y" | "3y" | "5y") {
  const response = await authlessClient.get<StockPricesResponse>(`/api/v1/stocks/${symbol}/prices/`, {
    params: { range },
  })
  return response.data
}

export async function getStockSearch(query: string) {
  const response = await authlessClient.get<StockSearchResponse>("/api/v1/stocks/search/", {
    params: { q: query },
  })
  return response.data
}

export function useStockProfile(symbol: string) {
  return useQuery({
    queryKey: ["stocks", "profile", symbol],
    queryFn: () => getStockProfile(symbol),
    enabled: Boolean(symbol),
    staleTime: DAY * 7,
  })
}

export function useStockPrices(symbol: string, range: "1y" | "3y" | "5y", enabled = true) {
  return useQuery({
    queryKey: ["stocks", "prices", symbol, range],
    queryFn: () => getStockPrices(symbol, range),
    enabled: Boolean(symbol) && enabled,
    staleTime: HOUR * 12,
  })
}

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: ["stocks", "search", query],
    queryFn: () => getStockSearch(query),
    enabled: query.trim().length > 0,
    staleTime: Math.min(DAY * 30, MAX_BROWSER_TIMEOUT_MS),
  })
}
