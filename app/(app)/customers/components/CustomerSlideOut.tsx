'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Building2,
  ShoppingCart,
  DollarSign,
  Calendar,
  TrendingUp,
  ExternalLink,
  Loader2,
  FileText,
  Link2,
  Clock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, getErpSyncStatusDisplay } from '@/lib/customers/services'
import { fetchCustomerOrders } from '@/lib/customers/actions'
import type { Customer } from '@/types/customers'

// Animation variants
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.25,
      ease: 'easeOut' as const,
    },
  }),
}

interface CustomerSlideOutProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  onCustomerUpdated?: (customer: Customer) => void
}

interface RecentOrder {
  id: string
  order_number: string
  received_date: string
  status: string
  order_value: number
  item_count: number
}

export function CustomerSlideOut({
  customer,
  isOpen,
  onClose,
  onEdit,
}: CustomerSlideOutProps) {
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)

  // Load recent orders when customer changes
  useEffect(() => {
    if (customer) {
      setIsLoadingOrders(true)
      fetchCustomerOrders(customer.id, 10)
        .then(({ orders }) => {
          setRecentOrders(orders)
        })
        .catch((err: unknown) => {
          console.error('Failed to load orders:', err)
          setRecentOrders([])
        })
        .finally(() => {
          setIsLoadingOrders(false)
        })
    } else {
      setRecentOrders([])
    }
  }, [customer])

  if (!customer) return null

  const erpStatus = getErpSyncStatusDisplay(customer.erp_sync_status)

  const formatAddress = (address: Customer['billing_address'] | Customer['shipping_address']) => {
    if (!address) return null
    const parts = [
      address.street,
      address.city,
      address.state && address.zip ? `${address.state} ${address.zip}` : address.state || address.zip,
      address.country,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  const formatAddressMultiline = (address: Customer['billing_address'] | Customer['shipping_address']) => {
    if (!address) return null
    return (
      <div className="text-sm text-slate-600">
        {address.street && <div>{address.street}</div>}
        {(address.city || address.state || address.zip) && (
          <div>
            {[address.city, address.state, address.zip].filter(Boolean).join(', ')}
          </div>
        )}
        {address.country && <div>{address.country}</div>}
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'waiting_review':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs whitespace-nowrap">Pending Review</Badge>
      case 'awaiting_clarification':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300 text-xs whitespace-nowrap">Needs Info</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs whitespace-nowrap">Approved</Badge>
      case 'processing':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-xs whitespace-nowrap">Processing</Badge>
      case 'archived':
        return <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-300 text-xs whitespace-nowrap">Archived</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-300 text-xs whitespace-nowrap">Rejected</Badge>
      default:
        return <Badge variant="outline" className="text-xs whitespace-nowrap">{status}</Badge>
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideCloseButton
        className={cn(
          'p-0 flex flex-col w-[1100px] max-w-[90vw]',
          'border-l border-slate-200/60',
          'shadow-[-20px_0_50px_rgba(15,23,42,0.08)]'
        )}
      >
        {/* Accessibility: Hidden title for screen readers */}
        <VisuallyHidden.Root>
          <SheetTitle>Customer: {customer.name}</SheetTitle>
        </VisuallyHidden.Root>

        {/* Panel Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/60 shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-slate-500" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                  {customer.name}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium px-2.5 py-0.5 rounded-full border-0',
                    customer.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {customer.customer_number && (
                <p className="text-sm text-slate-500 mt-0.5">#{customer.customer_number}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="h-9 px-4"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Panel Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">
            {/* Analytics Cards - Full Width */}
            <motion.div
              className="grid grid-cols-4 gap-4 mb-6"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-sm text-slate-500">Total Orders</div>
                </div>
                <div className="text-3xl font-semibold text-slate-900">{customer.total_orders}</div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-sm text-slate-500">Total Spend</div>
                </div>
                <div className="text-3xl font-semibold text-slate-900">{formatCurrency(customer.total_spend)}</div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-sm text-slate-500">Avg Order</div>
                </div>
                <div className="text-3xl font-semibold text-slate-900">
                  {customer.average_order_value ? formatCurrency(customer.average_order_value) : '-'}
                </div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="text-sm text-slate-500">Customer Since</div>
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {customer.first_order_date ? formatDate(customer.first_order_date) : formatDate(customer.created_at)}
                </div>
              </div>
            </motion.div>

            {/* Order History - Full Width */}
            <motion.div
              className="bg-white border border-slate-200/60 rounded-xl p-5 mb-6"
              custom={1}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  Order History
                </h3>
                {customer.total_orders > 10 && (
                  <a
                    href={`/orders?customer=${customer.id}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View all {customer.total_orders} orders
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {isLoadingOrders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : recentOrders.length > 0 ? (
                <div>
                  {/* Table Header */}
                  <div className="grid grid-cols-[minmax(140px,1fr)_120px_80px_120px_130px] gap-4 px-3 py-2 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <div>Order #</div>
                    <div>Date</div>
                    <div className="text-center">Items</div>
                    <div className="text-right">Value</div>
                    <div className="text-right">Status</div>
                  </div>
                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {recentOrders.map((order) => (
                      <a
                        key={order.id}
                        href={`/orders?order=${order.id}`}
                        className="grid grid-cols-[minmax(140px,1fr)_120px_80px_120px_130px] gap-4 px-3 py-3 hover:bg-slate-50 transition-colors items-center"
                      >
                        <div className="font-medium text-slate-900 text-sm">
                          {order.order_number}
                        </div>
                        <div className="text-sm text-slate-600">
                          {formatDate(order.received_date)}
                        </div>
                        <div className="text-sm text-slate-600 text-center">
                          {order.item_count}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 text-right">
                          {formatCurrency(order.order_value)}
                        </div>
                        <div className="flex justify-end">
                          {getStatusBadge(order.status)}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No orders yet</p>
                  <p className="text-xs text-slate-400 mt-1">Orders will appear here once placed</p>
                </div>
              )}
            </motion.div>

            {/* Three Column Layout for Details */}
            <div className="grid grid-cols-3 gap-5">
              {/* Contact Information */}
              <motion.div
                className="bg-white border border-slate-200/60 rounded-xl p-4"
                custom={2}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  Contact
                </h3>
                <div className="space-y-3">
                  {customer.primary_contact_name && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Contact</div>
                      <div className="text-sm font-medium text-slate-900 mt-0.5">{customer.primary_contact_name}</div>
                    </div>
                  )}
                  {customer.primary_contact_email && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Email</div>
                      <a
                        href={`mailto:${customer.primary_contact_email}`}
                        className="text-sm text-blue-600 hover:underline mt-0.5 block truncate"
                      >
                        {customer.primary_contact_email}
                      </a>
                    </div>
                  )}
                  {customer.primary_contact_phone && (
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide">Phone</div>
                      <a
                        href={`tel:${customer.primary_contact_phone}`}
                        className="text-sm text-blue-600 hover:underline mt-0.5 block"
                      >
                        {customer.primary_contact_phone}
                      </a>
                    </div>
                  )}
                  {!customer.primary_contact_name && !customer.primary_contact_email && !customer.primary_contact_phone && (
                    <p className="text-sm text-slate-400 italic">No contact info</p>
                  )}
                </div>
              </motion.div>

              {/* Addresses */}
              <motion.div
                className="bg-white border border-slate-200/60 rounded-xl p-4"
                custom={3}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  Addresses
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billing</div>
                    {customer.billing_address && formatAddress(customer.billing_address) ? (
                      formatAddressMultiline(customer.billing_address)
                    ) : (
                      <p className="text-sm text-slate-400 italic">Not provided</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shipping</div>
                    {customer.shipping_address && formatAddress(customer.shipping_address) ? (
                      formatAddressMultiline(customer.shipping_address)
                    ) : (
                      <p className="text-sm text-slate-400 italic">Not provided</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ERP Integration */}
              <motion.div
                className="bg-white border border-slate-200/60 rounded-xl p-4"
                custom={4}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  ERP
                </h3>
                {customer.erp_entity_id ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Status</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          erpStatus.color === 'green' && 'bg-green-50 text-green-700 border-green-300',
                          erpStatus.color === 'yellow' && 'bg-amber-50 text-amber-700 border-amber-300',
                          erpStatus.color === 'red' && 'bg-red-50 text-red-700 border-red-300',
                          erpStatus.color === 'gray' && 'bg-slate-50 text-slate-500 border-slate-300'
                        )}
                      >
                        {erpStatus.text}
                      </Badge>
                    </div>
                    {customer.erp_display_name && (
                      <div>
                        <span className="text-xs text-slate-500">Name</span>
                        <p className="text-sm text-slate-900 truncate">{customer.erp_display_name}</p>
                      </div>
                    )}
                    {customer.erp_synced_at && (
                      <div>
                        <span className="text-xs text-slate-500">Last Sync</span>
                        <p className="text-sm text-slate-600">{formatDate(customer.erp_synced_at)}</p>
                      </div>
                    )}
                    {customer.erp_sync_error && (
                      <div className="p-2 bg-red-50 rounded text-xs text-red-600 mt-2">
                        {customer.erp_sync_error}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Not linked</p>
                )}
              </motion.div>
            </div>

            {/* Notes - Full Width */}
            {customer.notes && (
              <motion.div
                className="bg-white border border-slate-200/60 rounded-xl p-4 mt-5"
                custom={5}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Notes
                </h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
              </motion.div>
            )}

            {/* Footer Timestamps */}
            <motion.div
              className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-400"
              custom={6}
              initial="hidden"
              animate="visible"
              variants={sectionVariants}
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Created {formatDate(customer.created_at)}
                </span>
                {customer.updated_at && customer.updated_at !== customer.created_at && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {formatDate(customer.updated_at)}
                  </span>
                )}
              </div>
              {customer.last_order_date && (
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Last order {formatDate(customer.last_order_date)}
                </span>
              )}
            </motion.div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
