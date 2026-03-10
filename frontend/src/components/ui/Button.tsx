import type { ButtonHTMLAttributes, PropsWithChildren } from "react"


type ButtonVariant = "primary" | "secondary" | "ghost"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-white shadow-panel hover:-translate-y-0.5 dark:bg-white dark:text-slate-900",
  secondary:
    "border border-border bg-white/80 text-ink hover:bg-white dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900",
  ghost:
    "bg-transparent text-ink hover:bg-black/5 dark:text-slate-100 dark:hover:bg-white/10",
}

export function Button({ children, className = "", type = "button", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-150 ${variantClasses[variant]} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
