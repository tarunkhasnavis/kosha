'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createProduct, updateProduct } from '@/lib/products/actions'
import type { Product } from '@/types/products'

interface ProductModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null  // null = creating new
  onCreated: (product: Product) => void
  onUpdated: (product: Product) => void
}

export function ProductModal({
  isOpen,
  onClose,
  product,
  onCreated,
  onUpdated,
}: ProductModalProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [isActive, setIsActive] = useState(true)

  const isEditing = product !== null

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen && product) {
      setSku(product.sku)
      setName(product.name)
      setUnitPrice(product.unit_price.toString())
      setIsActive(product.is_active)
    } else if (isOpen && !product) {
      setSku('')
      setName('')
      setUnitPrice('')
      setIsActive(true)
    }
  }, [isOpen, product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    if (!sku.trim()) {
      toast({ title: 'Error', description: 'SKU is required', variant: 'destructive' })
      return
    }
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' })
      return
    }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) {
      toast({ title: 'Error', description: 'Valid unit price is required', variant: 'destructive' })
      return
    }

    setIsSaving(true)

    if (isEditing) {
      const result = await updateProduct(product.id, {
        sku: sku.trim(),
        name: name.trim(),
        unit_price: price,
        is_active: isActive,
      })

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else if (result.product) {
        toast({ title: 'Product Updated', description: `${result.product.name} has been updated` })
        onUpdated(result.product)
      }
    } else {
      const result = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        unit_price: price,
        is_active: isActive,
      })

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else if (result.product) {
        toast({ title: 'Product Created', description: `${result.product.name} has been added` })
        onCreated(result.product)
      }
    }

    setIsSaving(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the product details below.'
                : 'Enter the product details below.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Item Number</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g., VL5002"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Ghia Aperitif 6/500ml"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g., 147.00"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Product' : 'Add Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
