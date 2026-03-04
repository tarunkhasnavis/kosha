'use client'

import { useState } from 'react'
import { ExtractedProduct } from '@/lib/onboarding/types'
import { Package, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface ProductPreviewCardProps {
  products: ExtractedProduct[]
  maxDisplay?: number
}

export function ProductPreviewCard({ products, maxDisplay = 5 }: ProductPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasMore = products.length > maxDisplay
  const displayProducts = isExpanded ? products : products.slice(0, maxDisplay)
  const remaining = products.length - maxDisplay

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Package className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">
          {products.length} product{products.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Product table */}
      <div className={isExpanded && products.length > 10 ? 'max-h-[300px] overflow-y-auto' : ''}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-600">SKU</th>
              <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-2 text-right font-medium text-slate-600">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayProducts.map((product, index) => (
              <tr key={product.sku || `product-${index}`} className="hover:bg-slate-50/50">
                <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                  {product.sku || '-'}
                </td>
                <td className="px-4 py-2 text-slate-900">
                  {product.name}
                </td>
                <td className="px-4 py-2 text-right text-slate-700 font-medium">
                  ${product.unit_price.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/collapse button */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 text-center text-xs text-slate-500 hover:text-slate-700 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show all {remaining} more product{remaining !== 1 ? 's' : ''}
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}
