'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Textarea } from '@kosha/ui'
import { useToast } from '@/hooks/use-toast'
import { Bot, Loader2, Pencil, X } from 'lucide-react'
import { saveSystemPrompt } from '@/lib/organizations/actions'

interface SystemPromptSettingsProps {
  organizationId: string
  initialPrompt: string | null
}

export function SystemPromptSettings({ organizationId, initialPrompt }: SystemPromptSettingsProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [savedPrompt, setSavedPrompt] = useState(initialPrompt || '')

  const hasChanges = prompt !== savedPrompt

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setPrompt(savedPrompt)
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)

    const result = await saveSystemPrompt(organizationId, prompt.trim() || null)

    if (!result.success) {
      toast({
        title: 'Error',
        description: result.error || 'Failed to save system prompt',
        variant: 'destructive',
      })
      setIsSaving(false)
      return
    }

    toast({
      title: 'Settings saved',
      description: 'AI instructions have been updated',
    })

    setSavedPrompt(prompt.trim())
    setIsSaving(false)
    setIsEditing(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">AI Instructions</CardTitle>
              <CardDescription>
                Custom instructions for how AI processes your orders
              </CardDescription>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter custom AI instructions for your organization...

Example:
VENDOR IDENTITY:
- Our company is &quot;Your Company Name&quot;
- We are a food distributor serving restaurants

CUSTOMER CONTEXT:
- Our customers include restaurants, delis, and stores
- Common products: deli meats, cheeses, produce

CLARIFICATION STYLE:
- Keep responses friendly and professional"
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              These instructions help the AI understand your business context when extracting order information from emails.
              Include details about your company name, customer types, common products, and communication style.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {savedPrompt ? (
              <div className="bg-gray-50 rounded-lg p-4 border">
                <pre className="whitespace-pre-wrap text-sm font-mono text-gray-700">
                  {savedPrompt}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No custom AI instructions configured.</p>
                <p className="text-sm">Click "Edit" to add instructions for how AI should process your orders.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
