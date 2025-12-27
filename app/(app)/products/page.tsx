import { createClient } from '@/utils/supabase/server'
import { getOrganizationId } from '@/lib/organizations/queries'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { ProductsList } from './components/ProductsList'
import type { Product } from '@/types/products'

async function getProducts(orgId: string): Promise<Product[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('organization_id', orgId)
    .order('sku', { ascending: true })

  if (error) {
    console.error('Failed to fetch products:', error)
    return []
  }

  return data || []
}

export default async function ProductsPage() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
            <p className="text-muted-foreground">
              You need to be part of an organization to view products.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const products = await getProducts(orgId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
            <p className="text-muted-foreground mt-1">
              Master catalog of products and SKUs for order processing
            </p>
          </div>

          {/* Products List */}
          <ProductsList initialProducts={products} />
        </div>
      </div>
    </div>
  )
}
