import { useParams } from "react-router-dom"

import { PageShell } from "../components/layout/PageShell"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"


export function DcfPage() {
  const { symbol = "AAPL" } = useParams()

  return (
    <PageShell
      description="The protected DCF route is available now so saved calculations can plug into an existing route later."
      eyebrow="Protected Route"
      title={`${symbol.toUpperCase()} DCF shell`}
    >
      <Card>
        <CardHeader>
          <CardTitle>DCF controls arrive in Week 4.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted dark:text-slate-300">
            This route is protected already because saving DCF scenarios is an authenticated workflow in the spec.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  )
}
