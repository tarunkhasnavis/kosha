export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  user_id: string
  organization_id: string
  account_id: string
  account_name: string
  task: string
  priority: TaskPriority
  due_date: string
  completed: boolean
  capture_id: string | null
  created_at: string
}
