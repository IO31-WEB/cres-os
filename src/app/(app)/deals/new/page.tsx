import { db } from '@/lib/db'
import { contacts, companies, properties, users } from '@/lib/db/schema'
import { DealForm } from '@/components/deals/deal-form'
import { createDeal } from '@/lib/actions/deals'
import { PIPELINE_IDS, type PipelineId } from '@/lib/pipelines'
import { requireUser } from '@/lib/auth'
import { contactsVisibleTo, propertiesVisibleTo, companiesVisibleTo } from '@/lib/visibility'

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const { pipeline } = await searchParams
  const defaultPipeline: PipelineId | undefined = PIPELINE_IDS.includes(pipeline as PipelineId)
    ? (pipeline as PipelineId)
    : undefined

  const user = await requireUser()

  const [allContacts, allCompanies, allProperties, allUsers] = await Promise.all([
    db.select().from(contacts).where(contactsVisibleTo(user, contacts)).orderBy(contacts.firstName),
    db.select().from(companies).where(companiesVisibleTo(user, companies)).orderBy(companies.name),
    db.select().from(properties).where(propertiesVisibleTo(user, properties)).orderBy(properties.formattedAddress),
    db.select().from(users).orderBy(users.name),
  ])

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">New deal</h2>
      <DealForm
        action={createDeal}
        contacts={allContacts}
        companies={allCompanies}
        properties={allProperties}
        users={allUsers}
        defaultPipeline={defaultPipeline}
      />
    </div>
  )
}
