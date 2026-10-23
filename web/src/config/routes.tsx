import type { ComponentType } from "react"
import { Navigate, type RouteObject } from "react-router-dom"

/**
 * Every page is code-split. With the data router, a route's code is loaded
 * *before* the navigation commits: the current page stays on screen and the
 * root layout shows a progress bar until the next page is ready.
 */
function page(load: () => Promise<{ default: ComponentType }>) {
  return async () => ({ Component: (await load()).default })
}

export const routes: RouteObject[] = [
  // Use relative path "dashboard" instead of "/dashboard" for basename compatibility
  { path: "/", element: <Navigate to="dashboard" replace /> },
  // Landing Page
  { path: "/landing", lazy: page(() => import("@/app/landing/page")) },
  // Dashboard Routes
  { path: "/dashboard", lazy: page(() => import("@/app/dashboard/page")) },
  { path: "/dashboard-2", lazy: page(() => import("@/app/dashboard-2/page")) },
  // Application Routes
  { path: "/mail", lazy: page(() => import("@/app/mail/page")) },
  { path: "/tasks", lazy: page(() => import("@/app/tasks/page")) },
  { path: "/chat", lazy: page(() => import("@/app/chat/page")) },
  { path: "/calendar", lazy: page(() => import("@/app/calendar/page")) },
  // Content Pages
  { path: "/users", lazy: page(() => import("@/app/users/page")) },
  { path: "/faqs", lazy: page(() => import("@/app/faqs/page")) },
  { path: "/pricing", lazy: page(() => import("@/app/pricing/page")) },
  // Authentication Routes
  {
    path: "/auth/sign-in",
    lazy: page(() => import("@/app/auth/sign-in/page")),
  },
  {
    path: "/auth/sign-in-2",
    lazy: page(() => import("@/app/auth/sign-in-2/page")),
  },
  {
    path: "/auth/sign-in-3",
    lazy: page(() => import("@/app/auth/sign-in-3/page")),
  },
  {
    path: "/auth/sign-up",
    lazy: page(() => import("@/app/auth/sign-up/page")),
  },
  {
    path: "/auth/sign-up-2",
    lazy: page(() => import("@/app/auth/sign-up-2/page")),
  },
  {
    path: "/auth/sign-up-3",
    lazy: page(() => import("@/app/auth/sign-up-3/page")),
  },
  {
    path: "/auth/forgot-password",
    lazy: page(() => import("@/app/auth/forgot-password/page")),
  },
  {
    path: "/auth/forgot-password-2",
    lazy: page(() => import("@/app/auth/forgot-password-2/page")),
  },
  {
    path: "/auth/forgot-password-3",
    lazy: page(() => import("@/app/auth/forgot-password-3/page")),
  },
  // Error Pages
  {
    path: "/errors/unauthorized",
    lazy: page(() => import("@/app/errors/unauthorized/page")),
  },
  {
    path: "/errors/forbidden",
    lazy: page(() => import("@/app/errors/forbidden/page")),
  },
  {
    path: "/errors/not-found",
    lazy: page(() => import("@/app/errors/not-found/page")),
  },
  {
    path: "/errors/internal-server-error",
    lazy: page(() => import("@/app/errors/internal-server-error/page")),
  },
  {
    path: "/errors/under-maintenance",
    lazy: page(() => import("@/app/errors/under-maintenance/page")),
  },
  // Settings Routes
  {
    path: "/settings/user",
    lazy: page(() => import("@/app/settings/user/page")),
  },
  {
    path: "/settings/account",
    lazy: page(() => import("@/app/settings/account/page")),
  },
  {
    path: "/settings/billing",
    lazy: page(() => import("@/app/settings/billing/page")),
  },
  {
    path: "/settings/appearance",
    lazy: page(() => import("@/app/settings/appearance/page")),
  },
  {
    path: "/settings/notifications",
    lazy: page(() => import("@/app/settings/notifications/page")),
  },
  {
    path: "/settings/connections",
    lazy: page(() => import("@/app/settings/connections/page")),
  },
  // Catch-all route for 404
  { path: "*", lazy: page(() => import("@/app/errors/not-found/page")) },
]
