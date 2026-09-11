import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { CompanyForm } from '@/components/companies/company-form'
import { createCompany } from '@/lib/actions/companies'

export default async function NewCompanyPage() {
  const allUsers = await db.select().from(users).orderBy(users.name)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">New company</h2>
      <CompanyForm action={createCompany} users={allUsers} />
    </div>
  )
}
