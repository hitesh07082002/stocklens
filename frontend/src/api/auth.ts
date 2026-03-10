import { authlessClient } from "./client"
import type { AuthResponse, LoginPayload, RefreshResponse, SignupPayload } from "../types/auth"


export const authApi = {
  async login(payload: LoginPayload) {
    const response = await authlessClient.post<AuthResponse>("/api/v1/auth/login/", payload)
    return response.data
  },
  async signup(payload: SignupPayload) {
    const response = await authlessClient.post<AuthResponse>("/api/v1/auth/signup/", payload)
    return response.data
  },
  async refresh(refresh: string) {
    const response = await authlessClient.post<RefreshResponse>("/api/v1/auth/refresh/", {
      refresh,
    })
    return response.data
  },
}
