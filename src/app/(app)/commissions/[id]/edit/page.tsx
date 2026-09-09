import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { commissions, deals } from '@/lib/db/schema'
import { CommissionForm } from '@/components/commissions/commission-form'
import { updateCommission, deleteCommission } from '@/lib/actions/commissions'
import { Button } from '@/components/ui/button'

export default async function EditCommissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const commissionId = Number(id)
  if (Number.isNaN(commissionId)) notFound()

  const [commission] = await db.select().from(commissions).where(eq(commissions.id, commissionId)).limit(1)
  if (!commission) notFound()

  const [deal] = await db.select().from(deals).where(eq(deals.id, commission.dealId)).limit(1)
  if (!deal) notFound()

  const boundUpdate = updateCommission.bind(null, commissionId)
  const boundDelete = deleteCommission.bind(null, commissionId, deal.id)

  return (
    <div className="max-w-md">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit commission</h2>
      <CommissionForm action={boundUpdate} commission={commission} deal={deal} />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete commission
        </Button>
      </form>
    </div>
  )
}
