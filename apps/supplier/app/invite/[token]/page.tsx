import { createServiceClient } from '@kosha/supabase/service'
import { getUser } from '@kosha/supabase'
import { redirect } from 'next/navigation'
import { InviteSignIn } from './InviteSignIn'
import { LoginBackground } from '@/app/login/LoginBackground'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // If already logged in, redirect to capture
  const user = await getUser()
  if (user) {
    redirect('/capture')
  }

  // Look up invite using service client (unauthenticated users can visit this page)
  const serviceClient = createServiceClient()
  const { data: invite } = await serviceClient
    .from('org_invites')
    .select('id, organization_id, expires_at')
    .eq('token', token)
    .single()

  if (!invite) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <LoginBackground />
        <div className="relative z-10 flex flex-col items-center px-4 text-center">
          <h1 className="mb-4 text-2xl font-medium text-slate-900">
            Invalid Invite Link
          </h1>
          <p className="text-muted-foreground max-w-sm">
            This invite link is not valid. Please ask your admin for a new invite.
          </p>
        </div>
      </div>
    )
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <LoginBackground />
        <div className="relative z-10 flex flex-col items-center px-4 text-center">
          <h1 className="mb-4 text-2xl font-medium text-slate-900">
            Invite Expired
          </h1>
          <p className="text-muted-foreground max-w-sm">
            This invite link has expired. Please ask your admin for a new invite.
          </p>
        </div>
      </div>
    )
  }

  // Get org name for display
  const { data: org } = await serviceClient
    .from('organizations')
    .select('name')
    .eq('id', invite.organization_id)
    .single()

  const orgName = org?.name || 'an organization'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <LoginBackground />

      <div className="absolute top-8 left-8 md:top-12 md:left-16 z-10">
        <span className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900/80">
          kosha
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center px-4">
        <h1 className="mb-3 text-3xl md:text-4xl font-medium tracking-tight text-slate-900 text-center">
          Join {orgName}
        </h1>
        <p className="mb-8 text-muted-foreground text-center max-w-sm">
          You&apos;ve been invited to join as a sales rep. Sign in with Google to get started.
        </p>

        <InviteSignIn token={token} />
      </div>
    </div>
  )
}
