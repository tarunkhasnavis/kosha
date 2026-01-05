"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus } from "lucide-react"
import type { EditableItem, CompletenessResult } from "@/lib/orders/completeness"

// Re-export for convenience
export type { EditableItem }

interface ItemsTableProps {
  items: EditableItem[]
  completeness: CompletenessResult | null
  inferredFields?: string[]  // Fields where AI made logical leaps (e.g., "items[0].sku")
  onUpdateItem: (id: string, field: keyof EditableItem, value: string | number) => void
  onDeleteItem: (id: string) => void
  onAddItem: () => void
}

// =============================================================================
// Constants
// =============================================================================

const QUANTITY_UNITS = [
  "each",
  "lbs",
  "kg",
  "oz",
  "cases",
  "boxes",
  "bags",
  "dozen",
  "packs",
  "units",
  "gallons",
  "liters",
]

// =============================================================================
// Helper Functions
// =============================================================================

function getMissingFieldClass(isMissing: boolean): string {
  return isMissing
    ? 'border-orange-400 ring-1 ring-orange-400 focus:border-orange-500 focus:ring-orange-500'
    : ''
}

function getInferredFieldClass(isInferred: boolean): string {
  return isInferred
    ? 'border-violet-400 ring-1 ring-violet-400 bg-violet-50 focus:border-violet-500 focus:ring-violet-500'
    : ''
}

function getFieldClass(isMissing: boolean, isInferred: boolean): string {
  // These should be mutually exclusive - a field is either missing OR inferred, never both
  // If somehow both (shouldn't happen), orange (missing) takes priority as the safer default
  if (isMissing) return getMissingFieldClass(true)
  if (isInferred) return getInferredFieldClass(true)
  return ''
}

// =============================================================================
// Sub-components
// =============================================================================

interface ItemRowProps {
  item: EditableItem
  itemIndex: number
  missingFields: string[]
  inferredFields: string[]  // Full paths like "items[0].sku"
  onUpdate: (field: keyof EditableItem, value: string | number) => void
  onDelete: () => void
}

function InferredFieldWrapper({
  children
}: {
  isInferred: boolean
  children: React.ReactNode
}) {
  // Just render children - purple highlight is applied via CSS classes on the input
  return <>{children}</>
}

function ItemRow({ item, itemIndex, missingFields, inferredFields, onUpdate, onDelete }: ItemRowProps) {
  const isFieldMissing = (field: string) => missingFields.includes(field)
  const isFieldInferred = (field: string) => inferredFields.includes(`items[${itemIndex}].${field}`)

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <InferredFieldWrapper isInferred={isFieldInferred('sku')}>
          <Input
            value={item.sku}
            onChange={(e) => onUpdate("sku", e.target.value)}
            placeholder="SKU"
            className={`h-8 text-sm ${getFieldClass(isFieldMissing('sku'), isFieldInferred('sku'))}`}
          />
        </InferredFieldWrapper>
      </td>
      <td className="px-4 py-3">
        <InferredFieldWrapper isInferred={isFieldInferred('name')}>
          <Input
            value={item.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Item description"
            className={`h-8 text-sm ${getFieldClass(isFieldMissing('name'), isFieldInferred('name'))}`}
          />
        </InferredFieldWrapper>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <InferredFieldWrapper isInferred={isFieldInferred('quantity')}>
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => onUpdate("quantity", parseInt(e.target.value) || 0)}
              min="0"
              step="1"
              className={`h-8 text-sm w-16 ${getFieldClass(isFieldMissing('quantity'), isFieldInferred('quantity'))}`}
            />
          </InferredFieldWrapper>
          <InferredFieldWrapper isInferred={isFieldInferred('quantity_unit')}>
            <Select
              value={item.quantity_unit}
              onValueChange={(value) => onUpdate("quantity_unit", value)}
            >
              <SelectTrigger className={`h-8 text-sm w-20 ${getFieldClass(isFieldMissing('quantity_unit'), isFieldInferred('quantity_unit'))}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Include current value if not in standard list */}
                {!QUANTITY_UNITS.includes(item.quantity_unit) && (
                  <SelectItem value={item.quantity_unit}>{item.quantity_unit}</SelectItem>
                )}
                {QUANTITY_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InferredFieldWrapper>
        </div>
      </td>
      <td className="px-4 py-3">
        <InferredFieldWrapper isInferred={isFieldInferred('unit_price')}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="number"
              value={item.unit_price}
              onChange={(e) => onUpdate("unit_price", e.target.value)}
              min="0"
              step="0.01"
              className={`h-8 text-sm pl-6 ${getFieldClass(isFieldMissing('unit_price'), isFieldInferred('unit_price'))}`}
            />
          </div>
        </InferredFieldWrapper>
      </td>
      <td className="px-4 py-3 text-right font-medium">
        ${item.total.toFixed(2)}
      </td>
      <td className="px-2 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function ItemsTable({
  items,
  completeness,
  inferredFields,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
}: ItemsTableProps) {
  const itemsNeedingAttention = completeness?.itemMissingFields.size ?? 0
  const safeInferredFields = inferredFields ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Items
        </h3>
        {itemsNeedingAttention > 0 && (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs">
            {itemsNeedingAttention} item{itemsNeedingAttention > 1 ? 's' : ''} need attention
          </Badge>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-32">
                SKU
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3">
                Description
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-36">
                Qty
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-28">
                Price
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-4 py-3 w-24">
                Total
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                itemIndex={index}
                missingFields={completeness?.itemMissingFields.get(item.id) ?? []}
                inferredFields={safeInferredFields}
                onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No items. Click "Add Item" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={onAddItem}>
        <Plus className="h-4 w-4 mr-1" />
        Add Item
      </Button>
    </div>
  )
}
