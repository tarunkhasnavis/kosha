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

          {/* VIP (iDig) — Distributor Depletion Data */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#1B365D]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1B365D">
                  <path d="M3 3h18v4H3V3zm0 6h8v12H3V9zm10 0h8v5h-8V9zm0 7h8v5h-8v-5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">VIP</p>
                <p className="text-xs text-stone-400">Distributor Depletion Data</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
              <span className="text-[10px] text-stone-400">Last sync: 6:00 AM</span>
            </div>
          </div>

          {/* Snowflake — Data Warehouse */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#29B5E8]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#29B5E8">
                  <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="#29B5E8" strokeWidth="2" strokeLinecap="round" fill="none" />
                  <circle cx="12" cy="2" r="1.5" fill="#29B5E8" />
                  <circle cx="12" cy="22" r="1.5" fill="#29B5E8" />
                  <circle cx="2" cy="12" r="1.5" fill="#29B5E8" />
                  <circle cx="22" cy="12" r="1.5" fill="#29B5E8" />
                  <circle cx="4.93" cy="4.93" r="1.5" fill="#29B5E8" />
                  <circle cx="19.07" cy="19.07" r="1.5" fill="#29B5E8" />
                  <circle cx="19.07" cy="4.93" r="1.5" fill="#29B5E8" />
                  <circle cx="4.93" cy="19.07" r="1.5" fill="#29B5E8" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">Snowflake</p>
                <p className="text-xs text-stone-400">Data Warehouse</p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
          </div>

          {/* Tracks — Image Recognition */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#FF6B35]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#FF6B35">
                  <rect x="2" y="3" width="20" height="18" rx="2" fill="none" stroke="#FF6B35" strokeWidth="2" />
                  <circle cx="8.5" cy="10" r="2.5" fill="#FF6B35" />
                  <path d="M21 18l-5-5-3 3-3-3-6 6" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">Tracks</p>
                <p className="text-xs text-stone-400">Image Recognition</p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 font-medium px-2.5 py-1 rounded-full bg-emerald-50">Connected</span>
          </div>

          {/* PowerBI — Analytics & Reporting */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-[#F2C811]/10 flex items-center justify-center">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#F2C811">
                  <rect x="14" y="4" width="4" height="16" rx="1" fill="#F2C811" />
                  <rect x="8" y="8" width="4" height="12" rx="1" fill="#F2C811" opacity="0.7" />
                  <rect x="2" y="12" width="4" height="8" rx="1" fill="#F2C811" opacity="0.4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-800">PowerBI</p>
                <p className="text-xs text-stone-400">Analytics & Reporting</p>
              </div>
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
