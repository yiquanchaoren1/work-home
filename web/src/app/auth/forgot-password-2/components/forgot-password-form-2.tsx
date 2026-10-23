"use client"

import { cn } from "@/lib/utils"
import { Field, FieldLabel } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ForgotPasswordForm2({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your email address and we'll send you a link to reset your
          password
        </p>
      </div>
      <div className="grid gap-6">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="m@example.com" required />
        </Field>
        <Button type="submit" className="w-full cursor-pointer">
          Send Reset Link
        </Button>
      </div>
      <div className="text-center text-sm">
        Remember your password?{" "}
        <a
          href="/templates/dashboard/shadcn-dashboard-landing-template/auth/sign-in-2"
          className="underline underline-offset-4"
        >
          Back to sign in
        </a>
      </div>
    </form>
  )
}
