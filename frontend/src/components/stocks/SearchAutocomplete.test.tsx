import { QueryClient } from "@tanstack/react-query"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HttpResponse, http } from "msw"
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { server } from "../../mocks/server"
import { renderWithProviders } from "../../test/test-utils"
import { SearchAutocomplete } from "./SearchAutocomplete"


function createNoRetryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        refetchOnWindowFocus: false,
        staleTime: 0,
      },
    },
  })
}

function StockProbe() {
  const location = useLocation()
  const { symbol } = useParams()

  return (
    <div>
      <div data-testid="location-probe">{location.pathname}</div>
      <div data-testid="symbol-probe">{symbol ?? ""}</div>
    </div>
  )
}

function renderAutocomplete(initialEntry = "/", queryClient?: QueryClient) {
  return renderWithProviders(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[initialEntry]}
    >
      <Routes>
        <Route path="/" element={<SearchAutocomplete />} />
        <Route path="/stocks/:symbol" element={<StockProbe />} />
      </Routes>
    </MemoryRouter>,
    queryClient,
  )
}

describe("SearchAutocomplete", () => {
  it("sanitizes the query and renders results from the debounced search", async () => {
    const seenQueries: string[] = []
    server.use(
      http.get("*/api/v1/stocks/search/", ({ request }) => {
        const url = new URL(request.url, "http://localhost:8000")
        seenQueries.push(url.searchParams.get("q") ?? "")

        return HttpResponse.json({
          results: [
            { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology" },
            { symbol: "AAPLX", name: "Apple Growth Fund", exchange: "NYSE", sector: "" },
          ],
          count: 2,
          source: "fmp",
        })
      }),
    )

    const user = userEvent.setup()
    renderAutocomplete()

    await user.type(screen.getByLabelText(/global stock search/i), "Apple!!!")
    expect(screen.queryByText(/apple inc\./i)).not.toBeInTheDocument()

    expect(await screen.findByText(/apple inc\./i)).toBeInTheDocument()
    expect(screen.getByText(/apple growth fund/i)).toBeInTheDocument()
    expect(screen.getAllByText(/fmp/i)).toHaveLength(2)
    await waitFor(() => expect(seenQueries.at(-1)).toBe("Apple"))
  })

  it("supports keyboard navigation and enter-to-navigate", async () => {
    const user = userEvent.setup()
    renderAutocomplete()

    await user.type(screen.getByLabelText(/global stock search/i), "Apple")
    await screen.findByText(/apple inc\./i)

    await user.keyboard("{ArrowDown}{Enter}")

    await waitFor(() => expect(screen.getByTestId("location-probe")).toHaveTextContent("/stocks/AAPL"))
    expect(screen.getByTestId("symbol-probe")).toHaveTextContent("AAPL")
  })

  it("shows an empty state when no results are returned", async () => {
    server.use(
      http.get("*/api/v1/stocks/search/", () =>
        HttpResponse.json({
          results: [],
          count: 0,
          source: "local",
        }),
      ),
    )

    const user = userEvent.setup()
    renderAutocomplete()

    await user.type(screen.getByLabelText(/global stock search/i), "Unknown")

    expect(await screen.findByText(/no stocks found for "Unknown"/i)).toBeInTheDocument()
  })

  it("shows an error state when search fails and closes on escape", async () => {
    server.use(
      http.get("*/api/v1/stocks/search/", () => HttpResponse.json({ detail: "upstream down" }, { status: 502 })),
    )

    const user = userEvent.setup()
    renderAutocomplete("/", createNoRetryQueryClient())

    const input = screen.getByLabelText(/global stock search/i)
    await user.type(input, "Apple")

    expect(await screen.findByText(/search unavailable/i)).toBeInTheDocument()

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByText(/search unavailable/i)).not.toBeInTheDocument())
  })
})
