import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { PropsWithChildren, ReactElement } from "react"
import { RouterProvider } from "react-router-dom"

import { createQueryClient } from "../lib/queryClient"

type AppRouter = Parameters<typeof RouterProvider>[0]["router"]

export function renderWithRouter(router: AppRouter, queryClient: QueryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function Providers({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function renderWithProviders(ui: ReactElement, queryClient: QueryClient = createQueryClient()) {
  return render(ui, {
    wrapper: ({ children }) => <Providers queryClient={queryClient}>{children}</Providers>,
  })
}
