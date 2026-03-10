import { forwardRef, type InputHTMLAttributes } from "react"


export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-2xl border border-border bg-white/90 px-4 py-3 text-sm text-ink outline-none ring-0 transition placeholder:text-muted focus:border-ink dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-400 ${className}`.trim()}
      {...props}
    />
  ),
)

Input.displayName = "Input"
