import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { WebhookEvent } from '@clerk/nextjs/server'

/**
 * Keeps `users` in sync with Clerk so the rest of the schema can hold plain
 * FKs to a local id instead of hitting Clerk's API on every join. The first
 * user ever created is made 'owner' (Mari); everyone after defaults to
 * 'agent' and can be promoted from Settings later.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await request.text()
  const webhook = new Webhook(webhookSecret)

  let event: WebhookEvent
  try {
    event = webhook.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = event.data
    const primaryEmail = email_addresses.find((e) => e.id === event.data.primary_email_address_id)
    const name = [first_name, last_name].filter(Boolean).join(' ') || primaryEmail?.email_address || 'Unnamed'

    const [existingCount] = await db.select({ id: users.id }).from(users).limit(1)
    const role = event.type === 'user.created' && !existingCount ? 'owner' : undefined

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)

    if (existing) {
      await db
        .update(users)
        .set({
          email: primaryEmail?.email_address ?? existing.email,
          name,
          imageUrl: image_url ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
    } else {
      await db.insert(users).values({
        id,
        email: primaryEmail?.email_address ?? '',
        name,
        imageUrl: image_url ?? null,
        role: role ?? 'agent',
      })
    }
  }

  if (event.type === 'user.deleted' && event.data.id) {
    await db.delete(users).where(eq(users.id, event.data.id))
  }

  return NextResponse.json({ received: true })
}
