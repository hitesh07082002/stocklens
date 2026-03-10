import { StrictMode } from "react"
import { screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { authApi } from "../../api/auth"
import { AppLayout } from "../layout/AppLayout"
import { LoginPage } from "../../pages/LoginPage"
import { WatchlistPage } from "../../pages/WatchlistPage"
import { ProtectedRoute } from "./ProtectedRoute"
import { useAuthStore } from "../../store/authStore"
import { renderWithProviders } from "../../test/test-utils"


function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
}


describe("ProtectedRoute", () => {
  function renderProtectedRoute(initialEntry = "/watchlist", options?: { strictMode?: boolean }) {
    const tree = (
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
      </MemoryRouter>
    )

    return renderWithProviders(
      options?.strictMode ? <StrictMode>{tree}</StrictMode> : tree,
    )
  }

  it("redirects unauthenticated users to login", async () => {
    renderProtectedRoute()

    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/login?next=%2Fwatchlist"))
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument()
  })

  it("restores a persisted user immediately and refreshes in the background", async () => {
    window.localStorage.setItem("user", JSON.stringify({ id: 7, email: "restored@example.com" }))
    window.localStorage.setItem("refresh_token", "persisted-refresh-token")

    renderProtectedRoute()

    await waitFor(() => expect(screen.getByRole("heading", { name: /watchlist shell/i })).toBeInTheDocument())
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe("mock-refreshed-access-token"))
    expect(screen.getByText("restored@example.com")).toBeInTheDocument()
    expect(window.localStorage.getItem("refresh_token")).toBe("mock-refreshed-refresh-token")
  })

  it("deduplicates bootstrap refresh in StrictMode and keeps the user signed in", async () => {
    let refreshAttempts = 0
    vi.spyOn(authApi, "refresh").mockImplementation(async (refreshToken) => {
      refreshAttempts += 1

      if (refreshToken !== "persisted-refresh-token") {
        throw new Error("Unexpected refresh token.")
      }

      if (refreshAttempts === 1) {
        return {
          access: "strictmode-access-token",
          refresh: "rotated-refresh-token",
        }
      }

      throw new Error("Token is invalid or expired.")
    })

    window.localStorage.setItem("user", JSON.stringify({ id: 8, email: "strictmode@example.com" }))
    window.localStorage.setItem("refresh_token", "persisted-refresh-token")

    renderProtectedRoute("/watchlist", { strictMode: true })

    await waitFor(() => expect(screen.getByRole("heading", { name: /watchlist shell/i })).toBeInTheDocument())
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe("strictmode-access-token"))

    expect(screen.getByText("strictmode@example.com")).toBeInTheDocument()
    expect(window.localStorage.getItem("refresh_token")).toBe("rotated-refresh-token")
    expect(refreshAttempts).toBe(1)
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
