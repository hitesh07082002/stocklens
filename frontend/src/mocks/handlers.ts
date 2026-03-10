import { http, HttpResponse } from "msw"


const loginResolver = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as { email: string; password: string }

  if (body.password !== "SecurePass123!") {
    return HttpResponse.json(
      { detail: "No active account found with the given credentials." },
      { status: 401 },
    )
  }

  return HttpResponse.json({
    access: "mock-access-token",
    refresh: "mock-refresh-token",
    user: {
      id: 1,
      email: body.email,
    },
  })
}

const signupResolver = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as { email: string }

  return HttpResponse.json(
    {
      access: "mock-access-token",
      refresh: "mock-refresh-token",
      user: {
        id: 1,
        email: body.email,
      },
    },
    { status: 201 },
  )
}

export const handlers = [
  http.options("http://localhost:8000/api/v1/auth/login/", () => new HttpResponse(null, { status: 204 })),
  http.post("http://localhost:8000/api/v1/auth/login/", loginResolver),
  http.post("/api/v1/auth/login/", loginResolver),
  http.post("http://localhost:8000/api/v1/auth/signup/", signupResolver),
  http.post("/api/v1/auth/signup/", signupResolver),
  http.post("http://localhost:8000/api/v1/auth/refresh/", () =>
    HttpResponse.json({
      access: "mock-refreshed-access-token",
      refresh: "mock-refreshed-refresh-token",
    }),
  ),
  http.post("/api/v1/auth/refresh/", () =>
    HttpResponse.json({
      access: "mock-refreshed-access-token",
      refresh: "mock-refreshed-refresh-token",
    }),
  ),
  http.get("http://localhost:8000/api/v1/stocks/search/", ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get("q") ?? ""

    if (!query) {
      return HttpResponse.json({ detail: "Query parameter 'q' is required." }, { status: 400 })
    }

    return HttpResponse.json({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          sector: "Technology",
        },
      ],
      count: 1,
      source: "local",
    })
  }),
  http.get("/api/v1/stocks/search/", ({ request }) => {
    const url = new URL(request.url, "http://localhost:8000")
    const query = url.searchParams.get("q") ?? ""

    if (!query) {
      return HttpResponse.json({ detail: "Query parameter 'q' is required." }, { status: 400 })
    }

    return HttpResponse.json({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          sector: "Technology",
        },
      ],
      count: 1,
      source: "local",
    })
  }),
  http.get("http://localhost:8000/api/v1/stocks/AAPL/", () =>
    HttpResponse.json({
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
    }),
  ),
  http.get("/api/v1/stocks/AAPL/", () =>
    HttpResponse.json({
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
    }),
  ),
  http.get("http://localhost:8000/api/v1/stocks/AAPL/prices/", () =>
    HttpResponse.json({
      symbol: "AAPL",
      range: "1y",
      prices: [
        { date: "2026-03-10", close: "185.5000", volume: 52340100 },
        { date: "2026-03-09", close: "183.2500", volume: 48920000 },
      ],
      count: 2,
    }),
  ),
  http.get("/api/v1/stocks/AAPL/prices/", ({ request }) => {
    const url = new URL(request.url, "http://localhost:8000")
    const range = (url.searchParams.get("range") ?? "1y") as "1y" | "3y" | "5y"

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
]
