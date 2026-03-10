import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { z } from "zod"

import { authApi } from "../api/auth"
import { Button } from "../components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card"
import { Input } from "../components/ui/Input"
import { sanitizeNextPath } from "../lib/navigation"
import { useAuthStore } from "../store/authStore"


const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm_password: z.string().min(8, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  })

type SignupFormValues = z.infer<typeof signupSchema>

export function SignupPage() {
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
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirm_password: "",
    },
  })

  if (user) {
    return <Navigate replace to={nextPath} />
  }

  async function onSubmit(values: SignupFormValues) {
    setFormError("")

    try {
      const response = await authApi.signup(values)
      setAuth(response)
      navigate(nextPath, { replace: true })
    } catch {
      setFormError("Unable to create that account right now.")
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Create your account.</CardTitle>
          <CardDescription>Week 1 uses email-only auth with JWT rotation and client-side token storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink dark:text-slate-100" htmlFor="signup-email">
                Email
              </label>
              <Input id="signup-email" placeholder="you@example.com" type="email" {...register("email")} />
              {errors.email ? <p className="text-sm text-red-600">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink dark:text-slate-100" htmlFor="signup-password">
                Password
              </label>
              <Input id="signup-password" placeholder="At least 8 characters" type="password" {...register("password")} />
              {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-ink dark:text-slate-100" htmlFor="signup-confirm-password">
                Confirm password
              </label>
              <Input
                id="signup-confirm-password"
                placeholder="Repeat your password"
                type="password"
                {...register("confirm_password")}
              />
              {errors.confirm_password ? <p className="text-sm text-red-600">{errors.confirm_password.message}</p> : null}
            </div>

            {formError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p> : null}

            <Button className="w-full justify-center" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted dark:text-slate-300">
            Already have an account?{" "}
            <Link className="font-semibold text-ink underline dark:text-slate-50" to="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
