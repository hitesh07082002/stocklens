export interface User {
  id: number
  email: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: User
}

export interface RefreshResponse {
  access: string
  refresh: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload extends LoginPayload {
  confirm_password: string
}
