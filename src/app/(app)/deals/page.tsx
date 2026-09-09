import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineTabs } from '@/components/deals/pipeline-tabs'
import { PipelineBoard } from '@/components/deals/pipeline-board'
import { PIPELINE_IDS, type PipelineId } from '@/lib/pipelines'

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const { pipeline } = await searchParams
  const active: PipelineId = PIPELINE_IDS.includes(pipeline as PipelineId) ? (pipeline as PipelineId) : 'business_brokerage'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Deals</h2>
        <Button asChild size="sm">
          <Link href="/deals/new">
            <Plus className="h-4 w-4" /> New deal
          </Link>
        </Button>
      </div>
      <PipelineTabs active={active} />
      <PipelineBoard pipeline={active} />
    </div>
  )
}
