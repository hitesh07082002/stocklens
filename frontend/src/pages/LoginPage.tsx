import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { z } from "zod"

import { authApi } from "../api/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { sanitizeNextPath } from "../lib/navigation"
import { Button } from "../components/ui/Button"
import { useAuthStore } from "../store/authStore"


const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [formError, setFormError] = useState("")
  const setAuth = useAuthStore((state) => state.setAuth)
  const user = useAuthStore((state) => state.user)
  const nextPath = sanitizeNextPath(searchParams.get("next"))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  if (user) {
    return <Navigate replace to={nextPath} />
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError("")

    try {
      const response = await authApi.login(values)
      setAuth(response)
      navigate(nextPath, { replace: true })
    } catch {
      setFormError("Unable to sign in with those credentials.")
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back.</CardTitle>
          <CardDescription>Log in to reach your watchlist, portfolio, and saved DCF workspaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink dark:text-slate-100" htmlFor="login-email">
                Email
              </label>
              <Input id="login-email" placeholder="you@example.com" type="email" {...register("email")} />
              {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink dark:text-slate-100" htmlFor="login-password">
                Password
              </label>
              <Input id="login-password" placeholder="********" type="password" {...register("password")} />
              {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
            </div>

            {formError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p> : null}

            <Button className="w-full justify-center" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted dark:text-slate-300">
            New to StockLens?{" "}
            <Link className="font-semibold text-ink underline dark:text-slate-50" to="/signup">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
