import { screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AppLayout } from "../layout/AppLayout"
import { LoginPage } from "../../pages/LoginPage"
import { WatchlistPage } from "../../pages/WatchlistPage"
import { ProtectedRoute } from "./ProtectedRoute"
import { render } from "@testing-library/react"
import { useAuthStore } from "../../store/authStore"


function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
}


describe("ProtectedRoute", () => {
  function renderProtectedRoute(initialEntry = "/watchlist") {
    return render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[initialEntry]}
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/watchlist" element={<WatchlistPage />} />
            </Route>
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    )
  }

  it("redirects unauthenticated users to login", async () => {
    renderProtectedRoute()

    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/login?next=%2Fwatchlist"))
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument()
  })

  it("clears auth and stays unauthenticated when user exists without refresh token", async () => {
    window.localStorage.setItem("user", JSON.stringify({ id: 7, email: "partial@example.com" }))

    renderProtectedRoute()

    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/login?next=%2Fwatchlist"))
    expect(useAuthStore.getState().user).toBeNull()
    expect(window.localStorage.getItem("user")).toBeNull()
    expect(window.localStorage.getItem("refresh_token")).toBeNull()
  })

  it("clears auth and stays unauthenticated when refresh token exists without user", async () => {
    window.localStorage.setItem("refresh_token", "orphaned-refresh-token")

    renderProtectedRoute()

    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/login?next=%2Fwatchlist"))
    expect(useAuthStore.getState().user).toBeNull()
    expect(window.localStorage.getItem("user")).toBeNull()
    expect(window.localStorage.getItem("refresh_token")).toBeNull()
  })
})
