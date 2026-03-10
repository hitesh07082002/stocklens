import { useParams } from "react-router-dom"

import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"


export function DashboardPage() {
  const { symbol = "AAPL" } = useParams()

  return (
    <PageShell
      description="Week 1 keeps the stock dashboard as a shell route so the Week 2 stock data layer can slot in without touching navigation."
      eyebrow="Public Route"
      title={`${symbol.toUpperCase()} dashboard shell`}
    >
      <Card>
        <CardHeader>
          <CardTitle>Data panels arrive in Week 2.</CardTitle>
          <CardDescription>
            Price chart, financials, metrics, and AI summary will mount here once the stock cache and FMP proxy land.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {["Price chart", "Financials", "AI summary"].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted dark:text-slate-300"
              >
                {item} placeholder
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  )
}
