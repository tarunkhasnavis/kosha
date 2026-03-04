'use client'

import { useState } from 'react'
import { Card, CardContent, Button, Input, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@kosha/ui'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Package,
  Upload,
} from 'lucide-react'
import { deleteProduct, toggleProductActive } from '@/lib/products/actions'
import { ProductModal } from './ProductModal'
import { CSVImportModal } from './CSVImportModal'
import type { Product } from '@kosha/types'

interface ProductsListProps {
  initialProducts: Product[]
}

export function ProductsList({ initialProducts }: ProductsListProps) {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filteredProducts = products.filter((product) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      product.sku.toLowerCase().includes(searchLower) ||
      product.name.toLowerCase().includes(searchLower)
    )
  })

  const activeProducts = filteredProducts.filter(p => p.is_active)
  const inactiveProducts = filteredProducts.filter(p => !p.is_active)

  const handleProductCreated = (product: Product) => {
    setProducts(prev => [...prev, product].sort((a, b) => a.sku.localeCompare(b.sku)))
    setShowAddModal(false)
  }

  const handleProductUpdated = (product: Product) => {
    setProducts(prev =>
      prev.map(p => p.id === product.id ? product : p).sort((a, b) => a.sku.localeCompare(b.sku))
    )
    setEditingProduct(null)
  }

  const handleToggleActive = async (product: Product) => {
    const result = await toggleProductActive(product.id, !product.is_active)
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p)
      )
      toast({
        title: product.is_active ? 'Product Deactivated' : 'Product Activated',
        description: `${product.name} has been ${product.is_active ? 'deactivated' : 'activated'}`,
      })
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return

    setIsDeleting(true)
    const result = await deleteProduct(deletingProduct.id)
    setIsDeleting(false)

    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id))
      toast({
        title: 'Product Deleted',
        description: `${deletingProduct.name} has been deleted`,
      })
    }
    setDeletingProduct(null)
  }

  const handleImportComplete = (created: number, updated: number) => {
    // Refresh products after import
    window.location.reload()
  }

  return (
    <>
      {/* Header Actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by SKU or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/60"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium shadow-sm gap-0 leading-none"
          >
            <Plus className="h-3.5 w-3.5 -mt-px" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {/* Products Table */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No products found' : 'No products yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Add products manually or import from a CSV file to build your catalog.'}
            </p>
            {!searchTerm && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportModal(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium shadow-sm gap-0 leading-none"
                >
                  <Plus className="h-3.5 w-3.5 -mt-px" />
                  Add Product
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell text-right w-[120px]">Unit Price</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Active products first */}
              {activeProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right font-medium">
                    ${product.unit_price.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                          <ToggleLeft className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingProduct(product)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {/* Inactive products */}
              {inactiveProducts.map((product) => (
                <TableRow key={product.id} className="opacity-60">
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right font-medium">
                    ${product.unit_price.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300">
                      Inactive
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(product)}>
                          <ToggleRight className="h-4 w-4 mr-2" />
                          Activate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingProduct(product)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Summary */}
      {filteredProducts.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
          {inactiveProducts.length > 0 && ` (${inactiveProducts.length} inactive)`}
        </div>
      )}

      {/* Add/Edit Modal */}
      <ProductModal
        isOpen={showAddModal || editingProduct !== null}
        onClose={() => {
          setShowAddModal(false)
          setEditingProduct(null)
        }}
        product={editingProduct}
        onCreated={handleProductCreated}
        onUpdated={handleProductUpdated}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deletingProduct !== null} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingProduct?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
