'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kosha/ui'
import { UserPlus, Copy, Check, Trash2, Link2, X } from 'lucide-react'
import { createInviteLink, removeTeamMember, revokeInvite } from '@/lib/team/actions'
import { toast } from '@/hooks/use-toast'
import type { TeamMember, ActiveInvite } from '@/lib/team/queries'

interface TeamMembersProps {
  members: TeamMember[]
  currentUserId: string
  activeInvite: ActiveInvite | null
}

export function TeamMembers({ members, currentUserId, activeInvite }: TeamMembersProps) {
  const router = useRouter()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleGenerateInvite() {
    setInviteLoading(true)
    const result = await createInviteLink()
    setInviteLoading(false)

    if (result.error || !result.token) {
      toast({ title: 'Error', description: result.error || 'Failed to create invite', variant: 'destructive' })
      return
    }

    setInviteUrl(`${window.location.origin}/invite/${result.token}`)
    setInviteDialogOpen(true)
    router.refresh()
  }

  function handleShowExistingInvite() {
    if (activeInvite) {
      setInviteUrl(`${window.location.origin}/invite/${activeInvite.token}`)
      setInviteDialogOpen(true)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast({ title: 'Link copied to clipboard' })
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevokeInvite() {
    if (!activeInvite) return
    const result = await revokeInvite(activeInvite.id)
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }
    toast({ title: 'Invite revoked' })
    setInviteDialogOpen(false)
    router.refresh()
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingId(memberId)
    const result = await removeTeamMember(memberId)
    setRemovingId(null)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Team member removed' })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
        <div className="flex gap-2">
          {activeInvite && (
            <Button variant="outline" size="sm" onClick={handleShowExistingInvite}>
              <Link2 className="h-4 w-4 mr-2" />
              View Invite Link
            </Button>
          )}
          <Button size="sm" onClick={handleGenerateInvite} disabled={inviteLoading}>
            <UserPlus className="h-4 w-4 mr-2" />
            {inviteLoading ? 'Creating...' : 'Invite Member'}
          </Button>
        </div>
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.full_name || '—'}
                  {member.id === currentUserId && (
                    <span className="text-xs text-muted-foreground ml-2">(you)</span>
                  )}
                </TableCell>
                <TableCell>{member.email || '—'}</TableCell>
                <TableCell>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? 'Admin' : 'Rep'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.created_at
                    ? new Date(member.created_at).toLocaleDateString()
                    : '—'}
                </TableCell>
                <TableCell>
                  {member.id !== currentUserId && (
                    <RemoveMemberButton
                      memberId={member.id}
                      memberName={member.full_name || member.email || 'this member'}
                      removing={removingId === member.id}
                      onRemove={handleRemoveMember}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3">
        {members.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-800">
                      {member.full_name || '—'}
                    </p>
                    {member.id === currentUserId && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {member.role === 'admin' ? 'Admin' : 'Rep'}
                    </Badge>
                    {member.created_at && (
                      <span className="text-xs text-muted-foreground">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {member.id !== currentUserId && (
                  <RemoveMemberButton
                    memberId={member.id}
                    memberName={member.full_name || member.email || 'this member'}
                    removing={removingId === member.id}
                    onRemove={handleRemoveMember}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite Link Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link with your team member. They&apos;ll join your organization as a sales rep when they sign in.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires in 7 days.
            </p>
            {activeInvite && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevokeInvite}
                className="text-red-500 hover:text-red-600"
              >
                <X className="h-4 w-4 mr-1" />
                Revoke invite
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface RemoveMemberButtonProps {
  memberId: string
  memberName: string
  removing: boolean
  onRemove: (id: string) => void
}

function RemoveMemberButton({ memberId, memberName, removing, onRemove }: RemoveMemberButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={removing}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {memberName} from your organization? They will lose access to all data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onRemove(memberId)}
            className="bg-red-600 hover:bg-red-700"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
