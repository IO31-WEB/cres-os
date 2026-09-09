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
