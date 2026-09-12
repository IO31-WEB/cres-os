import { NextRequest, NextResponse } from 'next/server'
import { generateDailyPriorities } from '@/lib/ai/priority-engine'
import { secretsMatch } from '@/lib/secrets'
import { logAuditBestEffort } from '@/lib/audit'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!secret || !secretsMatch(authHeader, `Bearer ${secret}`)) {
    await logAuditBestEffort({ actorLabel: 'cron:daily-priorities', action: 'cron.auth_failed', entityType: 'cron' })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const count = await generateDailyPriorities()
  return NextResponse.json({ generated: count })
}
