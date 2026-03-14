import { requireAuth } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { createClient } from '@kosha/supabase/server'
import { MainNav } from '@/components/main-nav'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import { getUserWithRole } from '@/lib/auth'

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const userInfo = await getUserWithRole()

  if (!userInfo?.orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">No Organization</h1>
          <p className="text-muted-foreground">
            Your account hasn&apos;t been assigned to an organization yet.
            Contact your admin to get access.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', userInfo.orgId)
    .single()

  if (org && org.name === user.email) {
    redirect('/onboarding')
  }

  return (
    <AppLayoutWrapper>
      <MainNav />
      <main className="pb-20 min-h-screen">
        {children}
      </main>
    </AppLayoutWrapper>
  )
}
