'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Settings2,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  AlertTriangle,
} from 'lucide-react'
import {
  saveCustomFields,
  checkPendingOrdersForNewFields,
  revalidatePendingOrdersForNewFields,
} from '@/lib/organizations/actions'
import type { OrgRequiredField } from '@/lib/orders/field-config'

// Reserved field names that conflict with existing order columns or system fields
const RESERVED_FIELD_NAMES = new Set([
  // System/database fields
  'id', 'created_at', 'updated_at', 'organization_id',
  // Existing order fields
  'order_number', 'company_name', 'source', 'status',
  'order_value', 'item_count', 'received_date', 'expected_delivery_date',
  'notes', 'billing_address', 'phone', 'payment_method',
  'contact_name', 'contact_email', 'ship_via', 'email_from', 'email_url',
  'clarification_message', 'custom_fields', 'items',
])

/**
 * Convert a display label to a valid snake_case field name
 */
function labelToFieldName(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscores
    .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
    .replace(/_+/g, '_')           // Collapse multiple underscores
}

interface CustomFieldsSettingsProps {
  organizationId: string
  initialFields: OrgRequiredField[]
}

export function CustomFieldsSettings({ organizationId, initialFields }: CustomFieldsSettingsProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [fields, setFields] = useState<OrgRequiredField[]>(initialFields)
  const [hasChanges, setHasChanges] = useState(false)

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [affectedOrderCount, setAffectedOrderCount] = useState(0)
  const [isCheckingOrders, setIsCheckingOrders] = useState(false)

  const addField = () => {
    const newField: OrgRequiredField = {
      field: '',
      label: '',
      type: 'text',
      required: true,
    }
    setFields([...fields, newField])
    setHasChanges(true)
  }

  const updateField = (index: number, updates: Partial<OrgRequiredField>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...updates }

    // Always auto-generate field name from label (user can't edit field name directly)
    if (updates.label !== undefined) {
      updated[index].field = labelToFieldName(updates.label)
    }

    setFields(updated)
    setHasChanges(true)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
    setHasChanges(true)
  }

  // Validate fields before save
  const validateFields = (): boolean => {
    // Validate: no empty labels
    const emptyLabels = fields.filter(f => !f.label.trim())
    if (emptyLabels.length > 0) {
      toast({
        title: 'Missing display label',
        description: 'Please enter a display label for all fields',
        variant: 'destructive',
      })
      return false
    }

    // Validate: no empty field names (shouldn't happen if label is filled, but check anyway)
    const emptyFieldNames = fields.filter(f => !f.field)
    if (emptyFieldNames.length > 0) {
      toast({
        title: 'Invalid field name',
        description: 'Could not generate a valid field name. Use only letters and numbers in the label.',
        variant: 'destructive',
      })
      return false
    }

    // Check for reserved/system field names
    const reservedConflicts = fields.filter(f => RESERVED_FIELD_NAMES.has(f.field))
    if (reservedConflicts.length > 0) {
      toast({
        title: 'Reserved field name',
        description: `"${reservedConflicts[0].label}" generates a reserved field name "${reservedConflicts[0].field}". Please choose a different label.`,
        variant: 'destructive',
      })
      return false
    }

    // Check for duplicate field names among custom fields
    const fieldNames = fields.map(f => f.field)
    const duplicates = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i)
    if (duplicates.length > 0) {
      toast({
        title: 'Duplicate field name',
        description: `Multiple fields would have the same name "${duplicates[0]}". Please use unique labels.`,
        variant: 'destructive',
      })
      return false
    }

    // Check for duplicate display labels
    const labels = fields.map(f => f.label.trim().toLowerCase())
    const duplicateLabels = labels.filter((label, i) => labels.indexOf(label) !== i)
    if (duplicateLabels.length > 0) {
      toast({
        title: 'Duplicate labels',
        description: 'Each field must have a unique display label',
        variant: 'destructive',
      })
      return false
    }

    return true
  }

  // Check if there are new required fields that might affect pending orders
  const hasNewRequiredFields = (): boolean => {
    const previousFieldNames = new Set(initialFields.filter(f => f.required).map(f => f.field))
    return fields.some(f => f.required && !previousFieldNames.has(f.field))
  }

  const handleSave = async () => {
    if (!validateFields()) return

    // Check if there are new required fields
    if (hasNewRequiredFields()) {
      // Check how many pending orders would be affected
      setIsCheckingOrders(true)
      const result = await checkPendingOrdersForNewFields(organizationId, fields, initialFields)
      setIsCheckingOrders(false)

      if (result.affectedCount > 0) {
        setAffectedOrderCount(result.affectedCount)
        setShowConfirmDialog(true)
        return
      }
    }

    // No affected orders or no new required fields, just save
    await performSave(false)
  }

  const performSave = async (revalidateOrders: boolean) => {
    setIsSaving(true)

    // Save the custom fields
    const result = await saveCustomFields(organizationId, fields)

    if (!result.success) {
      setIsSaving(false)
      toast({
        title: 'Error',
        description: result.error || 'Failed to save custom fields',
        variant: 'destructive',
      })
      return
    }

    // If user chose to revalidate orders, do that now
    if (revalidateOrders) {
      const revalidateResult = await revalidatePendingOrdersForNewFields(
        organizationId,
        fields,
        initialFields
      )

      if (revalidateResult.error) {
        toast({
          title: 'Warning',
          description: `Fields saved, but failed to update orders: ${revalidateResult.error}`,
          variant: 'destructive',
        })
      } else if (revalidateResult.movedCount > 0) {
        toast({
          title: 'Settings saved',
          description: `Custom fields updated. ${revalidateResult.movedCount} order${revalidateResult.movedCount > 1 ? 's' : ''} moved to "Needs Info".`,
        })
      } else {
        toast({
          title: 'Settings saved',
          description: 'Custom fields have been updated',
        })
      }
    } else {
      toast({
        title: 'Settings saved',
        description: 'Custom fields have been updated',
      })
    }

    setIsSaving(false)
    setHasChanges(false)
    setShowConfirmDialog(false)
  }

  const handleConfirmRevalidate = async () => {
    await performSave(true)
  }

  const handleSkipRevalidate = async () => {
    await performSave(false)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Custom Order Fields</CardTitle>
              <CardDescription>
                Define additional fields that AI should extract from orders
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fields List */}
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No custom fields configured.</p>
              <p className="text-sm">Click "Add Field" to create one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 border rounded-lg bg-gray-50"
                >
                  <div className="pt-2 text-gray-400 cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4">
                    {/* Label */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Display Label</Label>
                      <Input
                        placeholder="e.g., Liquor License"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                    </div>

                    {/* Field Name (auto-generated, read-only) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Field Name (auto-generated)</Label>
                      <Input
                        value={field.field || ''}
                        readOnly
                        disabled
                        placeholder="Generated from label..."
                        className="font-mono text-sm bg-gray-100 text-gray-600"
                      />
                    </div>

                    {/* Type */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Field Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: 'text' | 'number') => updateField(index, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Required Toggle */}
                    <div className="flex items-center justify-between pt-6">
                      <Label className="text-sm">Required for order completion</Label>
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => updateField(index, { required: checked })}
                      />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add Field Button */}
          <Button variant="outline" onClick={addField} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={isSaving || isCheckingOrders || !hasChanges}
            >
              {isSaving || isCheckingOrders ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isCheckingOrders ? 'Checking...' : 'Saving...'}
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Revalidating Orders */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              New Required Field Added
            </DialogTitle>
            <DialogDescription className="pt-2">
              You've added a new required field. There {affectedOrderCount === 1 ? 'is' : 'are'}{' '}
              <span className="font-semibold text-foreground">{affectedOrderCount} order{affectedOrderCount > 1 ? 's' : ''}</span>{' '}
              in "Pending Review" that {affectedOrderCount === 1 ? 'is' : 'are'} missing this field.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Would you like to move these orders to "Needs Info" so you can fill in the missing field before approving?
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleSkipRevalidate}
              disabled={isSaving}
            >
              No, Keep in Pending
            </Button>
            <Button
              onClick={handleConfirmRevalidate}
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Yes, Move to Needs Info
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
