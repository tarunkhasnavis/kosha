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
import { TeamMembers } from './components/team-members'

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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <OrganizationSettings
              orgId={org.id}
              initialName={org.name}
            />
          </CardContent>
        </Card>
      )}

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileSettings
              userId={profile.id}
              initialName={profile.full_name || ''}
              email={profile.email || ''}
              role={profile.role || 'rep'}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )

  // Reps see no tabs — just the general settings
  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>
        {generalContent}
      </div>
    )
  }

  // Admins see tabs: General + Team
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

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
