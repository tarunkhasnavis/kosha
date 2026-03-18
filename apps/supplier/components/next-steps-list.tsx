'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, ChevronDown, ChevronRight, Sparkles, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DatePicker,
} from '@kosha/ui'
import { toggleTaskCompleted, createTask, updateTask, deleteTask } from '@/lib/tasks/actions'
import type { Task } from '@kosha/types'
import type { Account } from '@kosha/types'

type TaskCategory = 'overdue' | 'today' | 'this_week' | 'later'

const CATEGORY_CONFIG = {
  overdue: { label: 'Overdue', color: 'text-stone-800', bgColor: 'bg-red-50' },
  today: { label: 'Today', color: 'text-stone-800', bgColor: 'bg-white' },
  this_week: { label: 'This Week', color: 'text-stone-800', bgColor: 'bg-white' },
  later: { label: 'Later', color: 'text-stone-500', bgColor: 'bg-white' },
} as const

function categorizeTask(task: Task): TaskCategory {
  if (task.completed) return 'later'

  // Parse due_date as local date (not UTC) to avoid timezone mismatch
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dueStr = task.due_date.slice(0, 10)

  if (dueStr < todayStr) return 'overdue'
  if (dueStr === todayStr) return 'today'

  const dueDate = new Date(dueStr + 'T00:00:00')
  const todayDate = new Date(todayStr + 'T00:00:00')
  const diffDays = Math.floor((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 7) return 'this_week'
  return 'later'
}

function formatDueDate(dateStr: string): string {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dueStr = dateStr.slice(0, 10)

  if (dueStr === todayStr) return 'Today'

  // Compare using local dates to avoid UTC offset issues
  const dueDate = new Date(dueStr + 'T00:00:00')
  const todayDate = new Date(todayStr + 'T00:00:00')
  const diffDays = Math.round((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'

  return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface NextStepsListProps {
  tasks: Task[]
  accounts: Account[]
  priorityAccounts?: Account[]
}

export function NextStepsList({ tasks, accounts, priorityAccounts = [] }: NextStepsListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [optimisticTasks, setOptimisticTasks] = useState(tasks)
  const [showCompleted, setShowCompleted] = useState(false)

  // Add Task dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskAccountId, setNewTaskAccountId] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined)
  const [creating, setCreating] = useState(false)

  // Edit Task dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTaskText, setEditTaskText] = useState('')
  const [editTaskDueDate, setEditTaskDueDate] = useState<Date | undefined>(undefined)
  const [editTaskPriority, setEditTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function openEditDialog(task: Task) {
    setEditingTask(task)
    setEditTaskText(task.task)
    setEditTaskDueDate(new Date(task.due_date + 'T12:00:00'))
    setEditTaskPriority(task.priority as 'high' | 'medium' | 'low')
    setEditOpen(true)
  }

  async function handleUpdateTask() {
    if (!editingTask || !editTaskText.trim() || !editTaskDueDate) return

    setUpdating(true)
    const result = await updateTask(editingTask.id, {
      task: editTaskText.trim(),
      dueDate: editTaskDueDate.toISOString().split('T')[0],
      priority: editTaskPriority,
    })
    setUpdating(false)

    if (result.success) {
      setOptimisticTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? { ...t, task: editTaskText.trim(), due_date: editTaskDueDate!.toISOString().split('T')[0], priority: editTaskPriority }
            : t
        )
      )
      setEditOpen(false)
      setEditingTask(null)
      router.refresh()
    }
  }

  async function handleDeleteTask() {
    if (!editingTask) return

    setDeleting(true)
    const result = await deleteTask(editingTask.id)
    setDeleting(false)

    if (result.success) {
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== editingTask.id))
      setEditOpen(false)
      setEditingTask(null)
      router.refresh()
    }
  }

  const selectedAccountForTask = accounts.find((a) => a.id === newTaskAccountId)

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !newTaskAccountId || !newTaskDueDate) return

    setCreating(true)
    const result = await createTask({
      accountId: newTaskAccountId,
      accountName: selectedAccountForTask?.name || '',
      task: newTaskDescription.trim()
        ? `${newTaskTitle.trim()} — ${newTaskDescription.trim()}`
        : newTaskTitle.trim(),
      dueDate: newTaskDueDate.toISOString().split('T')[0],
      priority: 'medium',
    })
    setCreating(false)

    if (result.success) {
      setAddOpen(false)
      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskAccountId('')
      setNewTaskDueDate(undefined)
      router.refresh()
    }
  }

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return optimisticTasks
    const query = search.toLowerCase()
    return optimisticTasks.filter(
      (t) =>
        t.task.toLowerCase().includes(query) ||
        t.account_name.toLowerCase().includes(query)
    )
  }, [optimisticTasks, search])

  const { categorized, completedTasks, suggestedTasks } = useMemo(() => {
    const incomplete = filteredTasks.filter((t) => !t.completed)
    const completed = filteredTasks.filter((t) => t.completed)

    const groups: Record<TaskCategory, Task[]> = {
      overdue: [],
      today: [],
      this_week: [],
      later: [],
    }

    for (const task of incomplete) {
      const category = categorizeTask(task)
      groups[category].push(task)
    }

    // Derive suggested tasks: incomplete tasks from highest-scored accounts
    const priorityAccountIds = new Set(priorityAccounts.map((a) => a.id))
    const scoreMap = new Map(priorityAccounts.map((a) => [a.id, a.score]))
    const suggested = incomplete
      .filter((t) => priorityAccountIds.has(t.account_id))
      .sort((a, b) => (scoreMap.get(b.account_id) || 0) - (scoreMap.get(a.account_id) || 0))
      .slice(0, 2)

    return { categorized: groups, completedTasks: completed, suggestedTasks: suggested }
  }, [filteredTasks, priorityAccounts])

  const handleToggle = async (taskId: string, completed: boolean) => {
    setOptimisticTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed } : t))
    )
    await toggleTaskCompleted(taskId, completed)
  }

  const categories: TaskCategory[] = ['overdue', 'today', 'this_week', 'later']

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur-sm px-4 pt-6 pb-3">
        <h1 className="text-2xl font-bold text-stone-800 mb-4">Tasks</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-800/10 focus:border-stone-300 transition-all"
          />
        </div>
      </div>

      {/* Task Sections */}
      <div className="flex-1 px-4 pb-24 space-y-6">
        {/* Suggested (AI-scored) */}
        {suggestedTasks.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-sm font-semibold text-stone-800">Suggested</h2>
            </div>
            <div className="space-y-2">
              {suggestedTasks.map((task) => (
                <TaskCard
                  key={`suggested-${task.id}`}
                  task={task}
                  category={categorizeTask(task)}
                  onToggle={handleToggle}
                  onEdit={openEditDialog}
                />
              ))}
            </div>
          </section>
        )}

        {categories.map((category) => {
          const tasksInCategory = categorized[category]
          if (tasksInCategory.length === 0) return null

          const config = CATEGORY_CONFIG[category]

          return (
            <section key={category}>
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-sm font-semibold ${config.color}`}>
                  {config.label}
                </h2>
              </div>
              <div className="space-y-2">
                {tasksInCategory.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    category={category}
                    onToggle={handleToggle}
                    onEdit={openEditDialog}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* Completed Section */}
        {completedTasks.length > 0 && (
          <section>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1.5 text-sm font-semibold text-stone-400 mb-2"
            >
              {showCompleted ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Completed ({completedTasks.length})
            </button>
            {showCompleted && (
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    category={categorizeTask(task)}
                    onToggle={handleToggle}
                    onEdit={openEditDialog}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty State */}
        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500">
              {search ? 'No tasks match your search' : 'No tasks yet'}
            </p>
          </div>
        )}
      </div>

      {/* FAB - Add Task */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed right-4 z-30 w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/25 active:scale-95 transition-transform"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Task Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Account</label>
              <Select value={newTaskAccountId} onValueChange={setNewTaskAccountId}>
                <SelectTrigger className="focus:ring-amber-600/30 focus:border-amber-600">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Title</label>
              <input
                type="text"
                placeholder="e.g. Follow up with Marcus"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Description</label>
              <textarea
                placeholder="Optional details..."
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white rounded-lg border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700 mb-1.5 block">Due Date</label>
              <DatePicker
                selected={newTaskDueDate}
                onSelect={setNewTaskDueDate}
                placeholder="Pick a date"
                className="focus-visible:ring-amber-600/30 focus-visible:border-amber-600"
              />
            </div>

            <button
              onClick={handleCreateTask}
              disabled={creating || !newTaskTitle.trim() || !newTaskAccountId || !newTaskDueDate}
              className="w-full py-2.5 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-medium rounded-lg disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {creating ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingTask(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Account</label>
                <p className="text-sm text-stone-500 px-3 py-2 bg-stone-50 rounded-lg">{editingTask.account_name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Task</label>
                <textarea
                  value={editTaskText}
                  onChange={(e) => setEditTaskText(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-stone-200 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Priority</label>
                <Select value={editTaskPriority} onValueChange={(v) => setEditTaskPriority(v as 'high' | 'medium' | 'low')}>
                  <SelectTrigger className="focus:ring-amber-600/30 focus:border-amber-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1.5 block">Due Date</label>
                <DatePicker
                  selected={editTaskDueDate}
                  onSelect={setEditTaskDueDate}
                  placeholder="Pick a date"
                  className="focus-visible:ring-amber-600/30 focus-visible:border-amber-600"
                />
              </div>

              <button
                onClick={handleUpdateTask}
                disabled={updating || !editTaskText.trim() || !editTaskDueDate}
                className="w-full py-2.5 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-medium rounded-lg disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {updating ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={handleDeleteTask}
                disabled={deleting}
                className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-stone-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  category: TaskCategory
  onToggle: (taskId: string, completed: boolean) => Promise<void>
  onEdit: (task: Task) => void
}

function TaskCard({ task, category, onToggle, onEdit }: TaskCardProps) {
  const isOverdue = category === 'overdue' && !task.completed
  const dueDateStr = category === 'today' ? 'Today' : formatDueDate(task.due_date)

  return (
    <div className="flex items-start gap-3 bg-white rounded-xl p-3.5 border border-stone-100 shadow-sm">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 transition-all ${
          task.completed
            ? 'bg-stone-800 border-stone-900'
            : 'border-stone-300 hover:border-stone-400'
        } flex items-center justify-center`}
      >
        {task.completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <button
        onClick={() => onEdit(task)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-semibold text-stone-800">
          {task.account_name}
        </p>
        <p className={`text-sm mt-0.5 ${task.completed ? 'line-through text-stone-400' : 'text-stone-600'}`}>
          {task.task}
        </p>
      </button>

      <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-lg ${
        isOverdue
          ? 'text-red-600 bg-red-50'
          : task.completed
            ? 'text-stone-400 bg-stone-50'
            : dueDateStr === 'Today'
              ? 'text-sky-700 bg-sky-50'
              : 'text-stone-500 bg-stone-50'
      }`}>
        {dueDateStr}
      </span>
    </div>
  )
}
