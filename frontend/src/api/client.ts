import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios"

import { clearStoredAuth, getRefreshToken, setRefreshToken } from "../lib/storage"
import { useAuthStore } from "../store/authStore"
import type { RefreshResponse } from "../types/auth"


type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const baseURL = import.meta.env.VITE_API_URL || ""

export const authlessClient = axios.create({
  baseURL,
})

const client = axios.create({
  baseURL,
})

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (!token) {
    return config
  }

  config.headers = config.headers ?? new AxiosHeaders()
  config.headers.set("Authorization", `Bearer ${token}`)
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    useAuthStore.getState().clearAuth()
    return null
  }

  try {
    const response = await authlessClient.post<RefreshResponse>("/api/v1/auth/refresh/", {
      refresh: refreshToken,
    })
    setRefreshToken(response.data.refresh)
    useAuthStore.getState().setAccessToken(response.data.access)
    return response.data.access
  } catch {
    clearStoredAuth()
    useAuthStore.getState().clearAuth()
    return null
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined
    const isAuthRoute = originalRequest?.url?.includes("/api/v1/auth/")

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthRoute) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null
    })
    const newAccessToken = await refreshPromise

    if (!newAccessToken) {
      return Promise.reject(error)
    }

    originalRequest.headers = originalRequest.headers ?? new AxiosHeaders()
    originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`)
    return client(originalRequest)
  },
)

export default client
