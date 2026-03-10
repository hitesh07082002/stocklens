import { http, HttpResponse } from "msw"


const loginResolver = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as { email: string; password: string }

  if (body.password !== "SecurePass123!") {
    return HttpResponse.json(
      { detail: "No active account found with the given credentials." },
      { status: 401 },
    )
  }

  return HttpResponse.json({
    access: "mock-access-token",
    refresh: "mock-refresh-token",
    user: {
      id: 1,
      email: body.email,
    },
  })
}

const signupResolver = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as { email: string }

  return HttpResponse.json(
    {
      access: "mock-access-token",
      refresh: "mock-refresh-token",
      user: {
        id: 1,
        email: body.email,
      },
    },
    { status: 201 },
  )
}

export const handlers = [
  http.options("http://localhost:8000/api/v1/auth/login/", () => new HttpResponse(null, { status: 204 })),
  http.post("http://localhost:8000/api/v1/auth/login/", loginResolver),
  http.post("/api/v1/auth/login/", loginResolver),
  http.post("http://localhost:8000/api/v1/auth/signup/", signupResolver),
  http.post("/api/v1/auth/signup/", signupResolver),
  http.post("http://localhost:8000/api/v1/auth/refresh/", () =>
    HttpResponse.json({
      access: "mock-refreshed-access-token",
      refresh: "mock-refreshed-refresh-token",
    }),
  ),
  http.post("/api/v1/auth/refresh/", () =>
    HttpResponse.json({
      access: "mock-refreshed-access-token",
      refresh: "mock-refreshed-refresh-token",
    }),
  ),
]
