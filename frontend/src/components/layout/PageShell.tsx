import type { PropsWithChildren } from "react"


interface PageShellProps extends PropsWithChildren {
  eyebrow: string
  title: string
  description: string
}

export function PageShell({ children, description, eyebrow, title }: PageShellProps) {
  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="inline-flex rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted dark:bg-slate-950/70">
          {eyebrow}
        </div>
        <div className="max-w-3xl space-y-3">
          <h1 className="font-display text-4xl text-ink dark:text-slate-50 md:text-5xl">{title}</h1>
          <p className="text-base leading-7 text-muted dark:text-slate-300">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
