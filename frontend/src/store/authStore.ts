import { create } from "zustand"

import { clearStoredAuth, setRefreshToken, setStoredUser } from "../lib/storage"
import type { AuthResponse, User } from "../types/auth"


interface AuthState {
  accessToken: string | null
  user: User | null
  isBootstrapping: boolean
  setAuth: (payload: AuthResponse) => void
  setAccessToken: (token: string | null) => void
  restoreUser: (user: User | null) => void
  finishBootstrapping: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isBootstrapping: true,
  setAuth: (payload) => {
    setRefreshToken(payload.refresh)
    setStoredUser(payload.user)
    set({
      accessToken: payload.access,
      user: payload.user,
      isBootstrapping: false,
    })
  },
  setAccessToken: (token) => set({ accessToken: token }),
  restoreUser: (user) => set({ user }),
  finishBootstrapping: () => set({ isBootstrapping: false }),
  clearAuth: () => {
    clearStoredAuth()
    set({
      accessToken: null,
      user: null,
      isBootstrapping: false,
    })
  },
}))
