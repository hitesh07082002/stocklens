import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect, useState, type ComponentType } from "react"
import { RouterProvider } from "react-router-dom"

import { createQueryClient } from "./lib/queryClient"
import { router } from "./router"

const queryClient = createQueryClient()
type ReactQueryDevtoolsComponent = ComponentType<{ initialIsOpen?: boolean }>

function App() {
  const [Devtools, setDevtools] = useState<ReactQueryDevtoolsComponent | null>(null)

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    let active = true

    void import("@tanstack/react-query-devtools").then(({ ReactQueryDevtools }) => {
      if (active) {
        setDevtools(() => ReactQueryDevtools)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {Devtools ? <Devtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}

export default App
