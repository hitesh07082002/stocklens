import { formatCurrency, formatLargeNumber, formatPercent, formatSignedCurrency } from "../../lib/utils"
import type { StockProfile } from "../../types/stock"


interface CompanyHeaderProps {
  profile: StockProfile
}

export function CompanyHeader({ profile }: CompanyHeaderProps) {
  const changeValue = profile.price_change ? Number.parseFloat(profile.price_change) : 0
  const changeTone =
    changeValue > 0
      ? "text-emerald-600 dark:text-emerald-300"
      : changeValue < 0
        ? "text-rose-600 dark:text-rose-300"
        : "text-muted dark:text-slate-300"

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted dark:text-slate-300">
            {profile.exchange || "US Equity"}
          </span>
          {profile.is_sp500 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
              S&amp;P 500
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-display text-4xl text-ink dark:text-slate-50 md:text-5xl">{profile.name}</h1>
            <span className="text-lg font-semibold uppercase tracking-[0.22em] text-muted dark:text-slate-300">
              {profile.symbol}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-muted dark:text-slate-300">
            <span>{profile.sector || "Sector pending"}</span>
            <span>•</span>
            <span>{profile.industry || "Industry pending"}</span>
            {profile.ceo ? (
              <>
                <span>•</span>
                <span>{profile.ceo}</span>
              </>
            ) : null}
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-7 text-muted dark:text-slate-300">
          {profile.description || "Profile description will populate as soon as the stock is cached through the backend."}
        </p>
      </div>

      <div className="rounded-[28px] border border-border bg-slate-950 px-6 py-6 text-slate-50 shadow-panel dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Current EOD Price</p>
        <div className="mt-4 flex items-end gap-3">
          <span className="font-display text-5xl">{formatCurrency(profile.last_price)}</span>
          <div className={`pb-1 text-sm font-semibold ${changeTone}`}>
            {formatSignedCurrency(profile.price_change)}
            <span className="ml-2">{formatPercent(profile.price_change_pct)}</span>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Market Cap</dt>
            <dd className="mt-1 text-lg font-semibold">{formatLargeNumber(profile.market_cap)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Updated</dt>
            <dd className="mt-1 text-lg font-semibold">
              {new Date(profile.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Website</dt>
            <dd className="mt-1 text-sm font-medium">
              {profile.website ? (
                <a className="underline decoration-amber-400 underline-offset-4" href={profile.website} rel="noreferrer" target="_blank">
                  {profile.website}
                </a>
              ) : (
                "Not available"
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
