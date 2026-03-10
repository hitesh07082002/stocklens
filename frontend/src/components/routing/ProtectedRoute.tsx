import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "../../store/authStore"


export function ProtectedRoute() {
  const location = useLocation()
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping)
  const user = useAuthStore((state) => state.user)

  if (isBootstrapping && !user) {
    return null
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate replace to={`/login?next=${next}`} />
  }

  return <Outlet />
}
