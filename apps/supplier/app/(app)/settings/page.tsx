import { createClient } from '@kosha/supabase/server'
import { getUserWithRole } from '@/lib/auth'
import { getTeamMembers, getActiveInvite } from '@/lib/team/queries'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@kosha/ui'
import { AlertCircle } from 'lucide-react'
import { OrganizationSettings } from './components/organization-settings'
import { ProfileSettings } from './components/profile-settings'
import { SettingsCard } from './components/settings-card'
import { TeamMembers } from './components/team-members'
import { SignOutButton } from './components/sign-out-button'
import { SalesforceSync } from './components/salesforce-sync'

async function getOrganizationData(orgId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('id, name, created_at')
    .eq('id', orgId)
    .single()
  return data
}

async function getProfileData(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('supplier_profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .single()
  return data
}

export default async function SettingsPage() {
  const userInfo = await getUserWithRole()

  if (!userInfo?.orgId) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-muted-foreground">No organization found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isAdmin = userInfo.role === 'admin'

  const [org, profile, teamResult, inviteResult] = await Promise.all([
    getOrganizationData(userInfo.orgId),
    getProfileData(userInfo.userId),
    isAdmin ? getTeamMembers() : Promise.resolve({ members: [] }),
    isAdmin ? getActiveInvite() : Promise.resolve({ invite: null }),
  ])

  const generalContent = (
    <div className="space-y-6">
      {org && (
        <SettingsCard title="Organization">
          <OrganizationSettings
            orgId={org.id}
            initialName={org.name}
          />
        </SettingsCard>
      )}

      {profile && (
        <SettingsCard title="Profile">
          <ProfileSettings
            userId={profile.id}
            initialName={profile.full_name || ''}
            email={profile.email || ''}
            role={profile.role || 'rep'}
          />
        </SettingsCard>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Salesforce */}
          <SalesforceSync />

          {/* Outlook */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#0078D4]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 6v12l10 4 10-4V6L12 2z" fill="#0078D4" />
                  <path d="M12 2L2 6v12l10-4V2z" fill="#0559B8" />
                  <path d="M12 14L2 18l10 4 10-4-10-4z" fill="#0078D4" opacity="0.7" />
                  <ellipse cx="8" cy="12" rx="3" ry="4" fill="white" />
                  <ellipse cx="8" cy="12" rx="2" ry="3" fill="#0078D4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-stone-800">Outlook</p>
            </div>
            <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
          </div>

          {/* Google Maps */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#34A853]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 2.61 1.43 4.88 3.54 6.15L12 11.5V2z" fill="#4285F4" />
                  <path d="M8.54 15.15C9.56 16.52 10.82 18.14 12 22c1.18-3.86 2.44-5.48 3.46-6.85L12 11.5 8.54 15.15z" fill="#34A853" />
                  <path d="M15.46 15.15C16.57 13.78 19 10.61 19 9c0-3.87-3.13-7-7-7v9.5l3.46 3.65z" fill="#FBBC04" />
                  <circle cx="12" cy="9" r="2.5" fill="white" />
                </svg>
              </div>
              <p className="text-sm font-medium text-stone-800">Google Maps</p>
            </div>
            <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
          </div>
        </CardContent>
      </Card>

      <SignOutButton />
    </div>
  )

  // Reps see no tabs — just the general settings
  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl pb-24">
        <h1 className="text-2xl font-semibold text-stone-800 mb-6">Settings</h1>
        {generalContent}
      </div>
    )
  }

  // Admins see tabs: General + Team
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl pb-24">
      <h1 className="text-2xl font-semibold text-stone-800 mb-6">Settings</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          {generalContent}
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamMembers
                members={teamResult.members}
                currentUserId={userInfo.userId}
                activeInvite={inviteResult.invite}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
