import { isAxiosError } from "axios"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { useStockPrices, useStockProfile } from "../api/stocks"
import { CompanyHeader } from "../components/stocks/CompanyHeader"
import { PriceChart } from "../components/stocks/PriceChart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"


export function DashboardPage() {
  const { symbol = "AAPL" } = useParams()
  const normalizedSymbol = symbol.toUpperCase()
  const [range, setRange] = useState<"1y" | "3y" | "5y">("1y")
  const profileQuery = useStockProfile(normalizedSymbol)
  const pricesQuery = useStockPrices(normalizedSymbol, range, profileQuery.isSuccess)
  const profileErrorStatus = isAxiosError(profileQuery.error) ? profileQuery.error.response?.status : undefined
  const hasProfileUnavailableState = !profileQuery.isPending && (profileQuery.isError || !profileQuery.data)

  useEffect(() => {
    setRange("1y")
  }, [normalizedSymbol])

  function renderHeader() {
    if (profileQuery.isPending) {
      return (
        <Card className="animate-pulse">
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-4">
              <div className="h-6 w-32 rounded-full bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-14 w-3/4 rounded-3xl bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-4 w-full rounded-full bg-slate-200/80 dark:bg-slate-800" />
              <div className="h-4 w-5/6 rounded-full bg-slate-200/80 dark:bg-slate-800" />
            </div>
            <div className="h-64 rounded-[28px] bg-slate-900/90" />
          </CardContent>
        </Card>
      )
    }

    if (profileQuery.isError || !profileQuery.data) {
      return (
        profileErrorStatus === 404 ? (
          <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle>Stock not found</CardTitle>
              <CardDescription>
                We could not find {normalizedSymbol}. Use the search bar above to look up another ticker or company name.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30">
            <CardHeader>
              <CardTitle>Upstream data unavailable</CardTitle>
              <CardDescription>
                The profile request for {normalizedSymbol} failed during the synchronous cache-through fetch. Retry once the upstream FMP request succeeds.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      )
    }

    return (
      <Card>
        <CardContent>
          <CompanyHeader profile={profileQuery.data} />
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="inline-flex rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted dark:bg-slate-950/70">
          Week 2 Dashboard
        </div>
        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-4xl text-ink dark:text-slate-50 md:text-5xl">{normalizedSymbol} stock dashboard</h1>
          <p className="text-base leading-7 text-muted dark:text-slate-300">
            The stock header and price chart are live against the new cache-through backend. The remaining dashboard panels stay explicitly deferred to Week 3.
          </p>
        </div>
      </div>

      {renderHeader()}

      {hasProfileUnavailableState ? null : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
              <CardDescription>
                Range toggles read from the cache-through price history endpoint for {normalizedSymbol} and render a TradingView Lightweight Charts EOD series.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pricesQuery.isPending ? (
                <div className="h-[420px] animate-pulse rounded-[24px] bg-slate-200/70 dark:bg-slate-900/70" />
              ) : pricesQuery.isError || !pricesQuery.data ? (
                <div className="rounded-[24px] border border-rose-200 px-6 py-16 text-center text-sm text-rose-700 dark:border-rose-900/60 dark:text-rose-200">
                  Price data is unavailable right now. If the symbol is valid, retry once the upstream cache-through fetch succeeds.
                </div>
              ) : (
                <PriceChart onRangeChange={setRange} prices={pricesQuery.data.prices} range={range} />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Financials",
                description: "Week 2 backend financials endpoint is live; chart rendering lands in Week 3.",
              },
              {
                title: "Key Metrics",
                description: "Metrics seeding and storage are ready for the screener and dashboard cards next week.",
              },
              {
                title: "AI Summary",
                description: "No Week 3 AI or health-score endpoints are added yet, per the documented boundary.",
              },
            ].map((panel) => (
              <Card key={panel.title}>
                <CardHeader>
                  <CardTitle className="text-2xl">{panel.title}</CardTitle>
                  <CardDescription>{panel.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-3xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted dark:text-slate-300">
                    {panel.title} stays intentionally deferred.
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
