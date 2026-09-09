'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyPriorities } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth'

export async function dismissPriority(priorityId: number): Promise<void> {
  await requireUser()
  await db.update(dailyPriorities).set({ dismissed: true }).where(eq(dailyPriorities.id, priorityId))
  revalidatePath('/dashboard')
}
