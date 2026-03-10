import type { User } from "../types/auth"


const REFRESH_TOKEN_KEY = "refresh_token"
const USER_KEY = "user"
const THEME_KEY = "theme"

export type ThemeMode = "light" | "dark"

function canUseStorage() {
  return typeof window !== "undefined"
}

function getStorage() {
  if (!canUseStorage()) {
    return null
  }

  const storage = window.localStorage
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null
  }

  return storage
}

export function getRefreshToken() {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  return storage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(REFRESH_TOKEN_KEY, token)
}

export function getStoredUser() {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const rawUser = storage.getItem(USER_KEY)
  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser) as User
  } catch {
    storage.removeItem(USER_KEY)
    return null
  }
}

export function setStoredUser(user: User) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth() {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.removeItem(REFRESH_TOKEN_KEY)
  storage.removeItem(USER_KEY)
}

export function getStoredTheme(): ThemeMode | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const value = storage.getItem(THEME_KEY)
  return value === "light" || value === "dark" ? value : null
}

export function setStoredTheme(theme: ThemeMode) {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.setItem(THEME_KEY, theme)
}
