import { useEffect } from "react"

import { authApi } from "../api/auth"
import { getRefreshToken, getStoredUser, setRefreshToken } from "../lib/storage"
import { useAuthStore } from "../store/authStore"

let bootstrapRefreshPromise: Promise<Awaited<ReturnType<typeof authApi.refresh>>> | null = null
let bootstrapRefreshToken: string | null = null

function refreshDuringBootstrap(refreshToken: string) {
  if (bootstrapRefreshPromise && bootstrapRefreshToken === refreshToken) {
    return bootstrapRefreshPromise
  }

  // React StrictMode remounts effects in dev, so bootstrap refresh must be shared.
  bootstrapRefreshToken = refreshToken
  bootstrapRefreshPromise = authApi.refresh(refreshToken).finally(() => {
    bootstrapRefreshPromise = null
    bootstrapRefreshToken = null
  })

  return bootstrapRefreshPromise
}

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
        const tokens = await refreshDuringBootstrap(refreshToken)
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
