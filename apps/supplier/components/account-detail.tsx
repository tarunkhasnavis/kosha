'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Separator,
  Skeleton,
} from '@kosha/ui'
import {
  Pencil,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  CalendarCheck,
  Sparkles,
  Camera,
  Users,
  Handshake,
  Plus,
  StickyNote,
} from 'lucide-react'
import { AccountForm } from './account-form'
import { TaskList } from './task-list'
import { ConversationList } from './conversation-list'
import { deleteAccount, clearAccountActivity } from '@/lib/accounts/actions'
import { toast } from '@/hooks/use-toast'
import type { Account, Visit, Insight, Task, Capture } from '@kosha/types'
import type { AccountContact, AccountNote, AccountPhoto } from '@kosha/types'

const insightTypeConfig: Record<string, { label: string; className: string }> = {
  demand: { label: 'Demand', className: 'bg-purple-100 text-purple-700' },
  competitive: { label: 'Competitive', className: 'bg-red-100 text-red-700' },
  friction: { label: 'Friction', className: 'bg-amber-100 text-amber-700' },
  expansion: { label: 'Expansion', className: 'bg-emerald-100 text-emerald-700' },
  relationship: { label: 'Relationship', className: 'bg-blue-100 text-blue-700' },
  promotion: { label: 'Promotion', className: 'bg-pink-100 text-pink-700' },
}

const premiseConfig: Record<string, { label: string; className: string }> = {
  on_premise: { label: 'On Premise', className: 'bg-emerald-50 text-emerald-700' },
  off_premise: { label: 'Off Premise', className: 'bg-sky-50 text-sky-700' },
  hybrid: { label: 'Hybrid', className: 'bg-amber-50 text-amber-700' },
}

type TabKey = 'summary' | 'touches' | 'notes' | 'contacts' | 'photos'

const TAB_CONFIG: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'summary', label: 'Summary', icon: Sparkles },
  { key: 'touches', label: 'Touches', icon: Handshake },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'photos', label: 'Photos', icon: Camera },
]

type Touch =
  | { kind: 'conversation'; date: string; title: string; capture: Capture }
  | { kind: 'visit'; date: string; title: string; visit: Visit }

function buildTouches(captures: Capture[], visits: Visit[]): Touch[] {
  const now = new Date()
  const pastVisits = visits.filter((v) => new Date(v.visit_date) < now)
  const touches: Touch[] = [
    ...captures.map((c): Touch => ({
      kind: 'conversation',
      date: c.created_at,
      title: 'Conversation',
      capture: c,
    })),
    ...pastVisits.map((v): Touch => ({
      kind: 'visit',
      date: v.visit_date,
      title: v.notes || 'Visit',
      visit: v,
    })),
  ]
  return touches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

interface AccountDetailProps {
  account: Account
  visits?: Visit[]
  insights?: Insight[]
  tasks?: Task[]
  captures?: Capture[]
  contacts?: AccountContact[]
  notes?: AccountNote[]
  photos?: AccountPhoto[]
  loading?: boolean
  onClose?: () => void
  onDeleted?: () => void
  onRefresh?: () => void
}

export function AccountDetail({
  account,
  visits,
  insights,
  tasks,
  captures,
  contacts,
  notes,
  photos,
  loading,
  onClose,
  onDeleted,
  onRefresh,
}: AccountDetailProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteAccount(account.id)
    setDeleting(false)

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
      return
    }

    toast({ title: 'Account deleted' })
    onDeleted?.()
    onClose?.()
  }


  const touches = buildTouches(captures || [], visits || [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {account.phone ? (
            <a href={`tel:${account.phone}`}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Phone className="h-4 w-4" />
              </Button>
            </a>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-stone-300"
              disabled
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center text-center -mt-2">
          <h2 className="text-lg font-bold text-stone-800">{account.name}</h2>
          {account.address && (
            <p className="text-sm text-stone-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{account.address}</span>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-1.5 mt-2.5">
            {account.industry && (
              <Badge className="bg-stone-200/60 text-stone-700 text-xs">
                {account.industry}
              </Badge>
            )}
            {account.premise_type && (() => {
              const pc = premiseConfig[account.premise_type]
              return (
                <Badge className={`${pc?.className || 'bg-stone-100 text-stone-600'} text-xs`}>
                  {pc?.label || account.premise_type}
                </Badge>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Tab Bar — Icon + Label, Horizontal Scroll */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div className="flex justify-center gap-1 border-b border-stone-100 pb-px">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex flex-col items-center gap-1 px-4 py-2.5 text-xs font-medium
                  transition-all duration-150 border-b-2 min-w-[60px]
                  ${isActive
                    ? 'border-stone-800 text-stone-800'
                    : 'border-transparent text-stone-400 hover:text-stone-600'}
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {/* AI Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                {/* Tasks */}
                <TaskList tasks={tasks || []} />

                <Separator />

                {/* Recent Notes — bullet points from latest captures */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Notes</h3>
                  {!captures || captures.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No notes captured yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {captures.slice(0, 2).map((capture) => (
                        <div key={capture.id} className="bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm">
                          <span className="text-xs text-muted-foreground">
                            {new Date(capture.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {capture.summary ? (
                            <ul className="mt-1.5 space-y-1">
                              {capture.summary.split(/\.\s+/).filter(Boolean).map((point, i) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                  <span className="text-stone-400 mt-0.5 shrink-0">&#8226;</span>
                                  <span>{point.endsWith('.') ? point : `${point}.`}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1.5">No summary available.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            {!photos || photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                  <Camera className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-sm font-medium text-stone-800 mb-1">No photos found</p>
                <p className="text-xs text-stone-500 mb-4">Add your first photo!</p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => toast({ title: 'Coming soon', description: 'Photo uploads will be available soon.' })}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Photo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-100">
                    <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                    {photo.caption && (
                      <p className="text-xs text-stone-500 mt-1 px-1 truncate">{photo.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div>
            {!contacts || contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-sm font-medium text-stone-800 mb-1">No contacts yet</p>
                <p className="text-xs text-stone-500">Contacts will appear here once added.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div key={contact.id} className="bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{contact.name}</p>
                        {contact.role && (
                          <p className="text-xs text-stone-500 mt-0.5">{contact.role}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-xs text-blue-600">
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div>
            {!notes || notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                  <StickyNote className="h-8 w-8 text-stone-300" />
                </div>
                <p className="text-sm font-medium text-stone-800 mb-1">No notes yet</p>
                <p className="text-xs text-stone-500">Notes added via Kosha will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm">
                    <p className="text-sm text-stone-700">{note.content}</p>
                    <p className="text-xs text-stone-400 mt-1.5">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Touches Tab */}
        {activeTab === 'touches' && (() => {
          const now = new Date()
          const upcomingVisits = (visits || [])
            .filter((v) => new Date(v.visit_date) >= now)
            .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())

          return (
            <div className="space-y-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <>
                  {/* Upcoming Visits */}
                  {upcomingVisits.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Visits</h3>
                      <div className="space-y-2">
                        {upcomingVisits.map((visit) => (
                          <div
                            key={visit.id}
                            className="flex items-center gap-3 bg-amber-50 rounded-xl p-3.5 border border-amber-100 shadow-sm"
                          >
                            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                              <CalendarCheck className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-stone-800">
                                {visit.notes || 'Scheduled Visit'}
                              </p>
                              <p className="text-xs text-amber-700 font-medium">
                                {new Date(visit.visit_date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Touches */}
                  {touches.length === 0 && upcomingVisits.length === 0 ? (
                    <div className="flex flex-col items-center py-8">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No touches recorded yet.
                      </p>
                    </div>
                  ) : touches.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">Past Touches</h3>
                      <div className="space-y-2">
                        {touches.map((touch) => {
                          if (touch.kind === 'conversation') {
                            return (
                              <ConversationList
                                key={touch.capture.id}
                                captures={[touch.capture]}
                                labelOverride="Conversation"
                              />
                            )
                          }
                          return (
                            <div
                              key={touch.visit.id}
                              className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm"
                            >
                              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <Navigation className="h-4 w-4 text-blue-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-stone-800">
                                  {touch.visit.notes || 'Visit'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(touch.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <AccountForm
            account={account}
            onSuccess={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
          />
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            disabled={clearing}
            onClick={async () => {
              setClearing(true)
              const result = await clearAccountActivity(account.id)
              setClearing(false)
              if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' })
              } else {
                toast({ title: 'Activity cleared' })
                setEditOpen(false)
                onRefresh?.()
              }
            }}
          >
            {clearing ? 'Clearing...' : 'Clear Activity'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50">
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{account.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>

    </div>
  )
}
