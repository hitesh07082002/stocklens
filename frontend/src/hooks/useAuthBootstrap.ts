import { useEffect } from "react"

import { authApi } from "../api/auth"
import { getRefreshToken, getStoredUser, setRefreshToken } from "../lib/storage"
import { useAuthStore } from "../store/authStore"


export function useAuthBootstrap() {
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const finishBootstrapping = useAuthStore((state) => state.finishBootstrapping)
  const restoreUser = useAuthStore((state) => state.restoreUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const storedUser = getStoredUser()
      const refreshToken = getRefreshToken()

      if (!storedUser && !refreshToken) {
        finishBootstrapping()
        return
      }

      if (!storedUser || !refreshToken) {
        clearAuth()
        return
      }

      restoreUser(storedUser)
      finishBootstrapping()

      try {
        const tokens = await authApi.refresh(refreshToken)
        if (!active) {
          return
        }

        setRefreshToken(tokens.refresh)
        setAccessToken(tokens.access)
      } catch {
        if (active) {
          clearAuth()
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [clearAuth, finishBootstrapping, restoreUser, setAccessToken])
}
