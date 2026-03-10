import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"


export function PortfolioPage() {
  return (
    <PageShell
      description="Portfolio tracking is protected from day one even though the holdings API arrives later in the build plan."
      eyebrow="Protected Route"
      title="Portfolio shell"
    >
      <Card>
        <CardHeader>
          <CardTitle>Ready for holdings and summaries.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted dark:text-slate-300">
            Week 4 will populate this with gain/loss calculations, sector allocation, and holding CRUD.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  )
}
