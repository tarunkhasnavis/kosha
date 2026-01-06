"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2, Plus, Undo2 } from "lucide-react"
import type { EditableItem, CompletenessResult } from "@/lib/orders/completeness"

// Re-export for convenience
export type { EditableItem }

interface ItemsTableProps {
  items: EditableItem[]
  deletedItems?: EditableItem[]
  completeness: CompletenessResult | null
  inferredFields?: string[]  // Fields where AI made logical leaps (e.g., "items[0].sku")
  readOnly?: boolean
  onUpdateItem: (id: string, field: keyof EditableItem, value: string | number) => void
  onDeleteItem: (id: string) => void
  onRestoreItem?: (id: string) => void
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
    ? 'border-[hsl(var(--attention-200))] bg-[hsl(var(--attention-50))]/50 focus:ring-2 focus:ring-[hsl(var(--attention-200))] focus:border-[hsl(var(--attention-200))]'
    : ''
}

function getInferredFieldClass(isInferred: boolean): string {
  return isInferred
    ? 'border-slate-300 bg-slate-50/50 focus:ring-2 focus:ring-slate-200 focus:border-slate-300'
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
  readOnly?: boolean
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

function ItemRow({ item, itemIndex, missingFields, inferredFields, readOnly, onUpdate, onDelete }: ItemRowProps) {
  const isFieldMissing = (field: string) => missingFields.includes(field)
  const isFieldInferred = (field: string) => inferredFields.includes(`items[${itemIndex}].${field}`)

  const disabledClass = readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''

  return (
    <tr className="hover:bg-slate-50/30 transition-colors">
      <td className="px-3 py-2.5">
        <InferredFieldWrapper isInferred={isFieldInferred('sku')}>
          <Input
            value={item.sku}
            onChange={(e) => onUpdate("sku", e.target.value)}
            placeholder="SKU"
            disabled={readOnly}
            className={`h-8 text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('sku'), isFieldInferred('sku'))} ${disabledClass}`}
          />
        </InferredFieldWrapper>
      </td>
      <td className="px-3 py-2.5">
        <InferredFieldWrapper isInferred={isFieldInferred('name')}>
          <Input
            value={item.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Item description"
            disabled={readOnly}
            className={`h-8 text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('name'), isFieldInferred('name'))} ${disabledClass}`}
          />
        </InferredFieldWrapper>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          <InferredFieldWrapper isInferred={isFieldInferred('quantity')}>
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => onUpdate("quantity", parseInt(e.target.value) || 0)}
              min="0"
              step="1"
              disabled={readOnly}
              className={`h-8 text-sm w-16 bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('quantity'), isFieldInferred('quantity'))} ${disabledClass}`}
            />
          </InferredFieldWrapper>
          <InferredFieldWrapper isInferred={isFieldInferred('quantity_unit')}>
            <Select
              value={item.quantity_unit}
              onValueChange={(value) => onUpdate("quantity_unit", value)}
              disabled={readOnly}
            >
              <SelectTrigger className={`h-8 text-sm w-20 bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('quantity_unit'), isFieldInferred('quantity_unit'))} ${disabledClass}`}>
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
      <td className="px-3 py-2.5">
        <InferredFieldWrapper isInferred={isFieldInferred('unit_price')}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              $
            </span>
            <Input
              type="number"
              value={item.unit_price}
              onChange={(e) => onUpdate("unit_price", e.target.value)}
              min="0"
              step="0.01"
              disabled={readOnly}
              className={`h-8 text-sm pl-6 bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('unit_price'), isFieldInferred('unit_price'))} ${disabledClass}`}
            />
          </div>
        </InferredFieldWrapper>
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-slate-700">
        ${item.total.toFixed(2)}
      </td>
      {!readOnly && (
        <td className="px-2 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      )}
    </tr>
  )
}

// =============================================================================
// Main Component
// =============================================================================

// Deleted item row component
function DeletedItemRow({
  item,
  onRestore
}: {
  item: EditableItem
  onRestore: () => void
}) {
  return (
    <tr className="bg-slate-50/50">
      <td className="px-3 py-2.5">
        <span className="text-sm text-slate-400">{item.sku || "—"}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-sm text-slate-400">{item.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-sm text-slate-400">
          {item.quantity} {item.quantity_unit}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-sm text-slate-400">${item.unit_price}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-sm text-slate-400">${item.total.toFixed(2)}</span>
      </td>
      <td className="px-2 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRestore}
          className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-colors"
          title="Restore item"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}

export function ItemsTable({
  items,
  deletedItems = [],
  completeness,
  inferredFields,
  readOnly,
  onUpdateItem,
  onDeleteItem,
  onRestoreItem,
  onAddItem,
}: ItemsTableProps) {
  const itemsNeedingAttention = completeness?.itemMissingFields.size ?? 0
  const safeInferredFields = inferredFields ?? []

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Items
        </h3>
        {!readOnly && itemsNeedingAttention > 0 && (
          <span className="text-xs text-[hsl(var(--attention-700))] bg-[hsl(var(--attention-100))] px-2 py-0.5 rounded-full">
            {itemsNeedingAttention} item{itemsNeedingAttention > 1 ? 's' : ''} need{itemsNeedingAttention === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      <div className="border border-slate-200/60 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide px-3 py-2.5 w-32">
                SKU
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide px-3 py-2.5">
                Description
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide px-3 py-2.5 w-36">
                Qty
              </th>
              <th className="text-left text-[11px] font-medium text-slate-400 uppercase tracking-wide px-3 py-2.5 w-28">
                Price
              </th>
              <th className="text-right text-[11px] font-medium text-slate-400 uppercase tracking-wide px-3 py-2.5 w-24">
                Total
              </th>
              {!readOnly && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                itemIndex={index}
                missingFields={completeness?.itemMissingFields.get(item.id) ?? []}
                inferredFields={safeInferredFields}
                readOnly={readOnly}
                onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
            {items.length === 0 && deletedItems.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Deleted Items Section */}
      {!readOnly && deletedItems.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Deleted Items ({deletedItems.length})
          </h4>
          <div className="border border-slate-200/60 rounded-lg overflow-hidden bg-slate-50/30">
            <table className="w-full">
              <tbody className="divide-y divide-slate-100">
                {deletedItems.map((item) => (
                  <DeletedItemRow
                    key={item.id}
                    item={item}
                    onRestore={() => onRestoreItem?.(item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!readOnly && (
        <Button variant="outline" size="sm" onClick={onAddItem} className="mt-3 h-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100/50 hover:text-slate-700">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Item
        </Button>
      )}
    </div>
  )
}
