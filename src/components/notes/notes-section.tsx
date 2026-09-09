import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notes, users } from '@/lib/db/schema'
import { AddNoteForm } from '@/components/notes/add-note-form'

interface NotesSectionProps {
  contactId?: number
  dealId?: number
  propertyId?: number
  revalidate: string
}

export async function NotesSection({ contactId, dealId, propertyId, revalidate }: NotesSectionProps) {
  const whereClause = contactId
    ? eq(notes.contactId, contactId)
    : dealId
      ? eq(notes.dealId, dealId)
      : propertyId
        ? eq(notes.propertyId, propertyId)
        : undefined

  const rows = whereClause
    ? await db
        .select({ note: notes, authorName: users.name })
        .from(notes)
        .leftJoin(users, eq(notes.authorUserId, users.id))
        .where(whereClause)
        .orderBy(desc(notes.createdAt))
    : []

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-ink">Activity</h3>
      <AddNoteForm contactId={contactId} dealId={dealId} propertyId={propertyId} revalidate={revalidate} />
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(({ note, authorName }) => (
            <li key={note.id} className="rounded border border-border bg-surface p-3 text-sm">
              <p className="text-ink">{note.content}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {authorName ?? 'Unknown'} · {note.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
