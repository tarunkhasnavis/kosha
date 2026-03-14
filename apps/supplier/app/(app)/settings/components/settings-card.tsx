'use client'

import { useState, createContext, useContext } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@kosha/ui'
import { Pencil } from 'lucide-react'

const EditContext = createContext<{ editing: boolean; onEditDone: () => void }>({
  editing: false,
  onEditDone: () => {},
})

export function useSettingsEdit() {
  return useContext(EditContext)
}

export function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false)

  return (
    <EditContext.Provider value={{ editing, onEditDone: () => setEditing(false) }}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">{title}</CardTitle>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </EditContext.Provider>
  )
}
