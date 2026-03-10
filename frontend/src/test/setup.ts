import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

import { server } from "../mocks/server"
import { useAuthStore } from "../store/authStore"


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
  window.localStorage.clear()
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isBootstrapping: false,
  })
})
