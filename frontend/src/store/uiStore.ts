import { create } from "zustand"

import { getStoredTheme, setStoredTheme, type ThemeMode } from "../lib/storage"


function resolveInitialTheme(): ThemeMode {
  const storedTheme = getStoredTheme()
  if (storedTheme) {
    return storedTheme
  }

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark"
  }

  return "light"
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return
  }

  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

const initialTheme = resolveInitialTheme()
applyTheme(initialTheme)

interface UiState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme)
    setStoredTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark"
    get().setTheme(nextTheme)
  },
}))
