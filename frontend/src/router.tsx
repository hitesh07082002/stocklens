import { createBrowserRouter } from "react-router-dom"

import { AppLayout } from "./components/layout/AppLayout"
import { ProtectedRoute } from "./components/routing/ProtectedRoute"
import { ComparePage } from "./pages/ComparePage"
import { DashboardPage } from "./pages/DashboardPage"
import { DcfPage } from "./pages/DcfPage"
import { LandingPage } from "./pages/LandingPage"
import { LoginPage } from "./pages/LoginPage"
import { PortfolioPage } from "./pages/PortfolioPage"
import { ScreenerPage } from "./pages/ScreenerPage"
import { SignupPage } from "./pages/SignupPage"
import { WatchlistPage } from "./pages/WatchlistPage"


export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/stocks/:symbol", element: <DashboardPage /> },
      { path: "/screener", element: <ScreenerPage /> },
      { path: "/compare", element: <ComparePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/watchlist", element: <WatchlistPage /> },
          { path: "/portfolio", element: <PortfolioPage /> },
          { path: "/dcf/:symbol", element: <DcfPage /> },
        ],
      },
    ],
  },
])
