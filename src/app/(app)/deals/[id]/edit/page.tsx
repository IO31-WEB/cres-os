import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deals, contacts, companies, properties, users } from '@/lib/db/schema'
import { DealForm } from '@/components/deals/deal-form'
import { updateDeal, deleteDeal } from '@/lib/actions/deals'
import { Button } from '@/components/ui/button'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dealId = Number(id)
  if (Number.isNaN(dealId)) notFound()

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1)
  if (!deal) notFound()

  const [allContacts, allCompanies, allProperties, allUsers] = await Promise.all([
    db.select().from(contacts).orderBy(contacts.firstName),
    db.select().from(companies).orderBy(companies.name),
    db.select().from(properties).orderBy(properties.formattedAddress),
    db.select().from(users).orderBy(users.name),
  ])

  const boundUpdate = updateDeal.bind(null, dealId)
  const boundDelete = deleteDeal.bind(null, dealId)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit deal</h2>
      <DealForm
        action={boundUpdate}
        deal={deal}
        contacts={allContacts}
        companies={allCompanies}
        properties={allProperties}
        users={allUsers}
      />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete deal
        </Button>
      </form>
    </div>
  )
}
