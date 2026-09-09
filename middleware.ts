import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Replaces the old HTTP Basic Auth gate now that this is a multi-user CRM
 * (Mari + agents), not a single-operator tool. Clerk owns the session;
 * everything is protected by default except sign-in/up and the Clerk
 * webhook, which Svix calls unauthenticated and verifies by signature
 * inside the route handler itself.
 */
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // Machine-to-machine endpoints — no Clerk session available. Each checks
  // its own shared secret inside the route handler (see LEAD_INTAKE_SECRET
  // and CRON_SECRET in docs/MODULE_8_SETUP.md / MODULE_9_SETUP.md).
  '/api/leads/inbound',
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
