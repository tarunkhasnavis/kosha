"use client"

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kosha/ui"
import { Trash2, Plus, Undo2 } from "lucide-react"
import type { EditableItem, CompletenessResult } from "@/lib/orders/completeness"
import type { Product } from "@kosha/types"
import { ProductCombobox } from "./ProductCombobox"

// Re-export for convenience
export type { EditableItem }

interface ItemsTableProps {
  items: EditableItem[]
  deletedItems?: EditableItem[]
  completeness: CompletenessResult | null
  inferredFields?: string[]  // Fields where AI made logical leaps (e.g., "items[0].sku")
  readOnly?: boolean
  products: Product[]  // Product catalog for SKU dropdown
  onUpdateItem: (id: string, field: keyof EditableItem, value: string | number) => void
  onDeleteItem: (id: string) => void
  onRestoreItem?: (id: string) => void
  onAddItem: () => void
  onProductSelect?: (itemId: string, product: Product) => void
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
  inferredFields: string[]
  readOnly?: boolean
  products: Product[]
  onUpdate: (field: keyof EditableItem, value: string | number) => void
  onDelete: () => void
  onProductSelect?: (product: Product) => void
}

function InferredFieldWrapper({
  children
}: {
  isInferred: boolean
  children: React.ReactNode
}) {
  return <>{children}</>
}

function ItemRow({ item, itemIndex, missingFields, inferredFields, readOnly, products, onUpdate, onDelete, onProductSelect }: ItemRowProps) {
  const isFieldMissing = (field: string) => missingFields.includes(field)
  const isFieldInferred = (field: string) => inferredFields.includes(`items[${itemIndex}].${field}`)

  const disabledClass = readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''

  return (
    <tr className="hover:bg-slate-50/30 transition-colors">
      <td className="px-3 py-2.5">
        <InferredFieldWrapper isInferred={isFieldInferred('sku')}>
          {readOnly ? (
            <Input
              value={item.sku}
              placeholder="SKU"
              disabled
              className={`h-8 text-sm bg-white border-slate-200 ${disabledClass}`}
            />
          ) : (
            <ProductCombobox
              value={item.sku}
              products={products}
              onProductSelect={(product) => onProductSelect?.(product)}
              placeholder="Search products..."
              searchField="sku"
              className={`h-8 text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('sku'), isFieldInferred('sku'))}`}
            />
          )}
        </InferredFieldWrapper>
      </td>
      <td className="px-3 py-2.5">
        <InferredFieldWrapper isInferred={isFieldInferred('name')}>
          {readOnly ? (
            <Input
              value={item.name}
              placeholder="Description"
              disabled
              className={`h-8 text-sm bg-white border-slate-200 ${disabledClass}`}
            />
          ) : (
            <ProductCombobox
              value={item.name}
              products={products}
              onProductSelect={(product) => onProductSelect?.(product)}
              placeholder="Search products..."
              searchField="name"
              className={`h-8 text-sm bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300 ${getFieldClass(isFieldMissing('name'), isFieldInferred('name'))}`}
            />
          )}
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
  products,
  onUpdateItem,
  onDeleteItem,
  onRestoreItem,
  onAddItem,
  onProductSelect,
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

      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {items.map((item, index) => {
          const missingFields = completeness?.itemMissingFields.get(item.id) ?? []
          const isFieldMissing = (field: string) => missingFields.includes(field)
          const isFieldInferred = (field: string) => safeInferredFields.includes(`items[${index}].${field}`)
          const disabledClass = readOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''

          return (
            <div key={item.id} className="border border-slate-200/60 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Item {index + 1}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteItem(item.id)}
                    className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wide">SKU</label>
                {readOnly ? (
                  <Input value={item.sku} placeholder="SKU" disabled className={`h-8 text-sm mt-1 ${disabledClass}`} />
                ) : (
                  <ProductCombobox
                    value={item.sku}
                    products={products}
                    onProductSelect={(product) => onProductSelect?.(item.id, product)}
                    placeholder="Search products..."
                    searchField="sku"
                    className={`h-8 text-sm mt-1 ${getFieldClass(isFieldMissing('sku'), isFieldInferred('sku'))}`}
                  />
                )}
              </div>
              <div>
                <label className="text-[11px] text-slate-400 uppercase tracking-wide">Description</label>
                {readOnly ? (
                  <Input value={item.name} placeholder="Description" disabled className={`h-8 text-sm mt-1 ${disabledClass}`} />
                ) : (
                  <ProductCombobox
                    value={item.name}
                    products={products}
                    onProductSelect={(product) => onProductSelect?.(item.id, product)}
                    placeholder="Search products..."
                    searchField="name"
                    className={`h-8 text-sm mt-1 ${getFieldClass(isFieldMissing('name'), isFieldInferred('name'))}`}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 uppercase tracking-wide">Qty</label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                      min="0"
                      disabled={readOnly}
                      className={`h-8 text-sm w-16 ${getFieldClass(isFieldMissing('quantity'), isFieldInferred('quantity'))} ${disabledClass}`}
                    />
                    <Select value={item.quantity_unit} onValueChange={(value) => onUpdateItem(item.id, "quantity_unit", value)} disabled={readOnly}>
                      <SelectTrigger className={`h-8 text-sm flex-1 ${disabledClass}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!QUANTITY_UNITS.includes(item.quantity_unit) && (
                          <SelectItem value={item.quantity_unit}>{item.quantity_unit}</SelectItem>
                        )}
                        {QUANTITY_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 uppercase tracking-wide">Price</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => onUpdateItem(item.id, "unit_price", e.target.value)}
                      min="0"
                      step="0.01"
                      disabled={readOnly}
                      className={`h-8 text-sm pl-6 ${getFieldClass(isFieldMissing('unit_price'), isFieldInferred('unit_price'))} ${disabledClass}`}
                    />
                  </div>
                </div>
              </div>
              <div className="text-right text-sm font-medium text-slate-700 pt-1 border-t border-slate-100">
                Total: ${item.total.toFixed(2)}
              </div>
            </div>
          )
        })}
        {items.length === 0 && deletedItems.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">No items.</div>
        )}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block border border-slate-200/60 rounded-lg overflow-hidden">
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
                products={products}
                onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
                onDelete={() => onDeleteItem(item.id)}
                onProductSelect={(product) => onProductSelect?.(item.id, product)}
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
