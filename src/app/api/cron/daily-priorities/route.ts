import { NextRequest, NextResponse } from 'next/server'
import { generateDailyPriorities } from '@/lib/ai/priority-engine'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const count = await generateDailyPriorities()
  return NextResponse.json({ generated: count })
}
