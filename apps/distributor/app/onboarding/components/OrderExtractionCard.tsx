'use client'

import { ExtractedOrder } from '@/lib/onboarding/types'
import { Building2, User, Package, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

interface OrderExtractionCardProps {
  order: ExtractedOrder
}

export function OrderExtractionCard({ order }: OrderExtractionCardProps) {
  const totalValue = order.items.reduce((sum, item) => {
    const itemTotal = item.quantity * (item.unit_price || 0)
    return sum + itemTotal
  }, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-900">
              {order.company_name || 'Unknown Company'}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="text-sm font-medium text-slate-700">
              ~${totalValue.toFixed(2)}
            </span>
          )}
        </div>
        {order.contact_name && (
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
            <User className="w-3 h-3" />
            <span>{order.contact_name}</span>
            {order.contact_email && (
              <span className="text-slate-400">({order.contact_email})</span>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-1.5">
          {order.items.slice(0, 5).map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-700 truncate flex-1">
                {item.name}
              </span>
              <span className="text-slate-500 ml-2">
                {item.quantity} {item.quantity_unit || 'units'}
              </span>
              {item.unit_price !== undefined && item.unit_price > 0 && (
                <span className="text-slate-600 ml-2 font-medium">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </span>
              )}
            </div>
          ))}
          {order.items.length > 5 && (
            <div className="text-xs text-slate-400">
              + {order.items.length - 5} more items
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 line-clamp-2">
              {order.notes}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
