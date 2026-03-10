import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"


export function WatchlistPage() {
  return (
    <PageShell
      description="This is the first protected route and the main Week 1 routing proof that auth state works end to end."
      eyebrow="Protected Route"
      title="Watchlist shell"
    >
      <Card>
        <CardHeader>
          <CardTitle>Protected route verified.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted dark:text-slate-300">
            If you can see this page after sign-in, JWT storage, route protection, and silent refresh are wired correctly for Week 1.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  )
}
