'use client'

import { useTransition } from 'react'
import { Badge, Checkbox } from '@kosha/ui'
import { toggleTaskCompleted } from '@/lib/tasks/actions'
import type { Task } from '@kosha/types'

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
}

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  const [isPending, startTransition] = useTransition()

  const incompleteTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  const handleToggle = (taskId: string, completed: boolean) => {
    startTransition(async () => {
      await toggleTaskCompleted(taskId, completed)
    })
  }

  const formatDueDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Follow-up Tasks
        {incompleteTasks.length > 0 && (
          <span className="text-xs font-normal ml-2">
            ({incompleteTasks.length} pending)
          </span>
        )}
      </h3>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {incompleteTasks.map((task) => {
            const priority = priorityConfig[task.priority] || priorityConfig.medium
            return (
              <div key={task.id} className="flex items-start gap-3 py-1.5">
                <Checkbox
                  checked={false}
                  disabled={isPending}
                  onCheckedChange={() => handleToggle(task.id, true)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{task.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${priority.className}`}>
                      {priority.label}
                    </Badge>
                    {formatDueDate(task.due_date) && (
                      <span className="text-xs text-muted-foreground">
                        Due {formatDueDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {completedTasks.length > 0 && (
            <>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  {completedTasks.length} completed
                </p>
              </div>
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 py-1 opacity-50">
                  <Checkbox
                    checked={true}
                    disabled={isPending}
                    onCheckedChange={() => handleToggle(task.id, false)}
                    className="mt-0.5"
                  />
                  <p className="text-sm text-muted-foreground line-through leading-relaxed">
                    {task.task}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
