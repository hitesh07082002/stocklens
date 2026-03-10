import type { HTMLAttributes, PropsWithChildren } from "react"


function merge(baseClassName: string, className?: string) {
  return `${baseClassName} ${className ?? ""}`.trim()
}

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={merge(
        "rounded-[28px] border border-border bg-white/85 p-6 shadow-panel backdrop-blur dark:bg-slate-950/70",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={merge("mb-5 flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h2 className={merge("font-display text-3xl text-ink dark:text-slate-50", className)} {...props}>
      {children}
    </h2>
  )
}

export function CardDescription({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p className={merge("text-sm text-muted dark:text-slate-300", className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={merge("space-y-4", className)} {...props}>
      {children}
    </div>
  )
}
