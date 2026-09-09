import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals } from '@/lib/db/schema'
import { CommissionForm } from '@/components/commissions/commission-form'
import { createCommission } from '@/lib/actions/commissions'

export default async function NewCommissionPage({ searchParams }: { searchParams: Promise<{ dealId?: string }> }) {
  const { dealId } = await searchParams
  const id = Number(dealId)
  if (!dealId || Number.isNaN(id)) notFound()

  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1)
  if (!deal) notFound()

  return (
    <div className="max-w-md">
      <h2 className="mb-6 text-lg font-semibold text-ink">New commission</h2>
      <CommissionForm action={createCommission} deal={deal} />
    </div>
  )
}
