import { CompanyForm } from '@/components/companies/company-form'
import { createCompany } from '@/lib/actions/companies'

export default function NewCompanyPage() {
  return (
    <div className="max-w-xl">
      <h2 className="mb-6 text-lg font-semibold text-ink">New company</h2>
      <CompanyForm action={createCompany} />
    </div>
  )
}
