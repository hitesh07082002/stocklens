import { Link } from "react-router-dom"

import { PageShell } from "../components/layout/PageShell"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"


const featureCards = [
  {
    title: "Auth Foundation",
    description: "Email-based signup/login with JWT rotation, Zustand memory access tokens, and silent refresh on reload.",
  },
  {
    title: "Protected Workspace",
    description: "Watchlist, portfolio, and DCF routes are gated now so Week 2 can attach real data without rewiring navigation.",
  },
  {
    title: "UI Shell",
    description: "Responsive navbar, footer, theme toggle, and route placeholders are ready for the stock modules.",
  },
]

export function LandingPage() {
  return (
    <PageShell
      description="StockLens is a Django + React investment research platform. Week 1 focuses on the foundation: auth, protected routing, testing, and CI."
      eyebrow="Foundation"
      title="A clean runway for the rest of StockLens."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Start with a real route graph.</CardTitle>
            <CardDescription>
              Landing, dashboard, screener, compare, watchlist, portfolio, DCF, login, and signup all exist now, even where the data layer is still placeholder-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <Link to="/stocks/AAPL">
                <Button className="w-full justify-center">Open Dashboard</Button>
              </Link>
              <Link to="/signup">
                <Button className="w-full justify-center" variant="secondary">
                  Create Account
                </Button>
              </Link>
              <Link to="/watchlist">
                <Button className="w-full justify-center" variant="ghost">
                  Test Protected Route
                </Button>
              </Link>
            </div>
            <div className="rounded-[24px] border border-border bg-slate-950 px-5 py-4 text-sm text-slate-100">
              <p className="font-semibold text-amber-300">Week 1 contract</p>
              <p className="mt-2 text-slate-300">
                Signup/login return <code className="rounded bg-white/10 px-1 py-0.5">{`{ access, refresh, user }`}</code>.
                Refresh returns <code className="rounded bg-white/10 px-1 py-0.5">{`{ access, refresh }`}</code>. No cookies. No Redis. No workers.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {featureCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle className="text-2xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted dark:text-slate-300">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
