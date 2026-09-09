'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUSINESS_PROFILE_LIST, type BusinessProfileId } from '@/lib/business-profiles'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { ScoreReport, type ScoreReportData } from '@/components/scorecard/score-report'

interface ScorecardLauncherProps {
  propertyId?: number
  defaultAddress?: string
  defaultBusinessProfile?: BusinessProfileId
}

export function ScorecardLauncher({ propertyId, defaultAddress, defaultBusinessProfile }: ScorecardLauncherProps) {
  const router = useRouter()
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [businessProfile, setBusinessProfile] = useState<BusinessProfileId>(defaultBusinessProfile ?? 'general')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScoreReportData | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, businessProfile, propertyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3 rounded border border-border bg-surface p-4">
        <FormField label="Property address" htmlFor="address">
          <Input
            id="address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1234 Dale Mabry Hwy, Tampa, FL 33607"
            disabled={!!propertyId}
          />
        </FormField>
        <FormField
          label="Intended business use"
          htmlFor="businessProfile"
          hint="Scoring — especially nearby retail — is weighted for this specific use, so the same address can score differently depending on what you select."
        >
          <Select id="businessProfile" value={businessProfile} onChange={(e) => setBusinessProfile(e.target.value as BusinessProfileId)}>
            {BUSINESS_PROFILE_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </form>

      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-6">
          <ScoreReport result={result} />
        </div>
      )}
    </div>
  )
}
