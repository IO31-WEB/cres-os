import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies, users } from '@/lib/db/schema'
import { CompanyForm } from '@/components/companies/company-form'
import { updateCompany, deleteCompany } from '@/lib/actions/companies'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { canViewCompany } from '@/lib/visibility'

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const companyId = Number(id)
  if (Number.isNaN(companyId)) notFound()

  const user = await requireUser()
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
  if (!company || !canViewCompany(user, company)) notFound()

  const allUsers = await db.select().from(users).orderBy(users.name)

  const boundUpdate = updateCompany.bind(null, companyId)
  const boundDelete = deleteCompany.bind(null, companyId)

  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Edit company</h2>
      <CompanyForm action={boundUpdate} company={company} users={allUsers} />
      <form action={boundDelete} className="mt-6 border-t border-border pt-6">
        <Button type="submit" variant="destructive" size="sm">
          Delete company
        </Button>
      </form>
    </div>
  )
}
