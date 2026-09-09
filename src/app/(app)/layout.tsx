import { requireUser } from '@/lib/auth'
import { AppShell } from '@/components/shell/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Confirms the Clerk session is synced to a local `users` row before
  // rendering anything that assumes one exists (assignment dropdowns, etc.)
  await requireUser()

  return <AppShell>{children}</AppShell>
}
