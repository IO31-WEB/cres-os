import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Replaces the old HTTP Basic Auth gate now that this is a multi-user CRM
 * (Mari + agents), not a single-operator tool. Clerk owns the session;
 * everything is protected by default except sign-in/up and the handful of
 * server-to-server endpoints that carry their own independent secret-based
 * authentication (checked inside the route handler itself, not here):
 *   - /api/webhooks/clerk — Svix signature verification
 *   - /api/leads/inbound — x-lead-intake-secret header
 *   - /api/cron/* — `Authorization: Bearer <CRON_SECRET>` from Vercel Cron
 * None of these callers have a Clerk session, so without this exclusion
 * the middleware would redirect them to /sign-in before the route handler
 * ever ran its own check — silently breaking lead intake and the daily
 * cron job in production despite each having real auth of its own.
 */
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/leads/inbound(.*)',
  '/api/cron(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  const { userId, redirectToSignIn } = await auth()
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url })
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
}
