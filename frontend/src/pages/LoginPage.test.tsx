import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AppLayout } from "../components/layout/AppLayout"
import { ProtectedRoute } from "../components/routing/ProtectedRoute"
import { useAuthStore } from "../store/authStore"
import { WatchlistPage } from "./WatchlistPage"
import { LoginPage } from "./LoginPage"
import { renderWithProviders } from "../test/test-utils"


describe("LoginPage", () => {
  it("renders and submits the login form", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={["/login?next=/watchlist"]}
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/watchlist" element={<WatchlistPage />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole("heading", { name: /welcome back/i })
    await user.type(screen.getByLabelText(/email/i), "investor@example.com")
    await user.type(screen.getByLabelText(/password/i), "SecurePass123!")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(screen.getByRole("heading", { name: /watchlist shell/i })).toBeInTheDocument())
    expect(window.localStorage.getItem("refresh_token")).toBe("mock-refresh-token")
    expect(useAuthStore.getState().user?.email).toBe("investor@example.com")
  })
})
