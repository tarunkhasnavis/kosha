import { getUserOrganization } from '@/lib/organizations/queries'
import { redirect } from 'next/navigation'
import { CreateOrganizationForm } from './CreateOrganizationForm'

export default async function CreateOrganizationPage() {
  // Check if user already has an organization
  const org = await getUserOrganization()

  if (org) {
    // User already has org, redirect to orders
    redirect('/orders')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create Your Organization</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This will be the name of your workspace
          </p>
        </div>

        <CreateOrganizationForm />
      </div>
    </div>
  )
}
