import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { companies } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireUser } from '@/lib/auth'
import { companiesVisibleTo } from '@/lib/visibility'

export default async function CompaniesPage() {
  const user = await requireUser()
  const visibility = companiesVisibleTo(user, companies)
  const rows = await db.select().from(companies).where(visibility).orderBy(desc(companies.updatedAt))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Companies</h2>
          <p className="text-sm text-ink-muted">{rows.length} total</p>
        </div>
        <Button asChild size="sm">
          <Link href="/companies/new">
            <Plus className="h-4 w-4" /> New company
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add the businesses and organizations tied to your contacts and deals."
          actionHref="/companies/new"
          actionLabel="New company"
        />
      ) : (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Industry</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((company) => (
                <tr key={company.id} className="hover:bg-surface">
                  <td className="px-4 py-2.5">
                    <Link href={`/companies/${company.id}`} className="font-medium text-ink hover:underline">
                      {company.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-2.5 text-ink-muted sm:table-cell">{company.industry ?? '—'}</td>
                  <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">{company.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
