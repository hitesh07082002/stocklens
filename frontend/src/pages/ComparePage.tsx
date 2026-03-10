import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"


export function ComparePage() {
  return (
    <PageShell
      description="Compare will later line up 2-3 stocks side by side. For Week 1, the route and shared shell are enough."
      eyebrow="Public Route"
      title="Comparison shell"
    >
      <Card>
        <CardHeader>
          <CardTitle>Ready for multi-stock inputs.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted dark:text-slate-300">
            The compare UI is intentionally deferred until the metrics and chart endpoints exist.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  )
}
