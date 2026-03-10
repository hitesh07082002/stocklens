import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"

import { useAuthStore } from "../../store/authStore"
import { useUiStore } from "../../store/uiStore"
import { Button } from "../ui/Button"


const navigation = [
  { label: "Dashboard", to: "/stocks/AAPL" },
  { label: "Screener", to: "/screener" },
  { label: "Compare", to: "/compare" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Portfolio", to: "/portfolio" },
]

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)

  function handleLogout() {
    clearAuth()
    navigate("/")
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-white/75 backdrop-blur dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link className="font-display text-3xl text-ink dark:text-slate-50" to="/">
              StockLens
            </Link>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Week 1
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-border bg-white/80 px-4 py-2 dark:bg-slate-950/80 lg:max-w-md">
              <input
                aria-label="Stock search placeholder"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted dark:text-slate-50"
                placeholder="Search placeholder: AAPL, MSFT, Apple..."
                type="search"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button aria-label="Toggle dark mode" onClick={toggleTheme} variant="secondary">
                {theme === "dark" ? "Light" : "Dark"}
              </Button>

              {user ? (
                <>
                  <span className="rounded-full border border-border px-3 py-2 text-sm text-muted dark:text-slate-300">
                    {user.email}
                  </span>
                  <Button onClick={handleLogout} variant="ghost">
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)} variant="ghost">
                    Login
                  </Button>
                  <Button onClick={() => navigate("/signup")} variant="primary">
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 text-sm font-medium">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-2 transition ${
                  isActive
                    ? "bg-ink text-white dark:bg-white dark:text-slate-900"
                    : "text-muted hover:bg-black/5 hover:text-ink dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
                }`
              }
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
