import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"

import { server } from "../mocks/server"
import { useAuthStore } from "../store/authStore"


vi.mock("lightweight-charts", () => {
  const fitContent = vi.fn()
  const setData = vi.fn()
  const addSeries = vi.fn(() => ({ setData }))
  const timeScale = vi.fn(() => ({ fitContent }))
  const remove = vi.fn()
  const createChart = vi.fn(() => ({
    addSeries,
    timeScale,
    remove,
  }))

  return {
    AreaSeries: Symbol("AreaSeries"),
    createChart,
  }
})


function createStorageMock() {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorageMock(),
  })
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterAll(() => server.close())
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  window.localStorage.clear()
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isBootstrapping: true,
  })
})
