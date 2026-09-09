import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { createUploadUrl, publicUrlFor, documentKey } from '@/lib/r2'

const requestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
})

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null)
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Provide a file name and content type.' }, { status: 400 })
  }

  const key = documentKey(parsed.fileName)

  try {
    const uploadUrl = await createUploadUrl(key, parsed.contentType)
    return NextResponse.json({ uploadUrl, fileUrl: publicUrlFor(key) })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not prepare upload.' },
      { status: 500 }
    )
  }
}
