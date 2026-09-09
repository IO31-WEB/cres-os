import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireUser, isOwner } from '@/lib/auth'
import { RoleSelect } from '@/components/settings/role-select'

export default async function SettingsPage() {
  const currentUser = await requireUser()
  const allUsers = await db.select().from(users).orderBy(users.createdAt)
  const owner = isOwner(currentUser)

  return (
    <div className="max-w-2xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">Settings</h2>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink">Team</h3>
        {!owner && <p className="mb-3 text-xs text-ink-muted">Only owners can change roles.</p>}
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2.5 text-ink">{u.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <RoleSelect userId={u.id} currentRole={u.role} disabled={!owner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
