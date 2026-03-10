import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"


export function ScreenerPage() {
  return (
    <PageShell
      description="The screener route is ready for the seeded S&P 500 table, manual filters, and natural-language parsing later in the build plan."
      eyebrow="Public Route"
      title="Screener shell"
    >
      <Card>
        <CardHeader>
          <CardTitle>Filters and results land in Week 5.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted dark:text-slate-300">
            This page exists now so routing, layout, dark mode, and navigation are stable before the actual screener data model appears.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  )
}
