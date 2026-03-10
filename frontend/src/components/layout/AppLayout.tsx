import { Outlet } from "react-router-dom"

import { useAuthBootstrap } from "../../hooks/useAuthBootstrap"
import { Footer } from "./Footer"
import { Navbar } from "./Navbar"

export function AppLayout() {
  useAuthBootstrap()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(14,116,144,0.18),_transparent_35%),linear-gradient(180deg,_#f4f0e8,_#fcfbf7)] text-ink dark:bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(180deg,_#050816,_#0f172a)] dark:text-slate-50">
      <Navbar />
      <main className="mx-auto min-h-[calc(100vh-12rem)] max-w-6xl px-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
