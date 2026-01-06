"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, CheckCircle, Clock, Archive, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OrderRow, OrderRowSkeleton } from "./components/OrderRow"
import { OrderEditPanel, type OrderFieldsWithOrgFields, type PanelMode } from "./components/OrderEditPanel"
import { AddOrderModal } from "./components/AddOrderModal"
import { RejectOrderModal } from "./components/RejectOrderModal"
import {
  saveOrderChanges,
  saveAndApproveOrder,
  saveAndAnalyzeOrder,
  approveOrder,
  rejectOrder,
  requestOrderInfo,
  saveClarificationMessage,
  type EditableItemInput,
  type SaveAndAnalyzeResult,
} from "@/lib/orders/actions"
import { createClient } from "@/utils/supabase/client"
import type { Order, OrderStats } from "@/types/orders"
import type { OrgRequiredField } from "@/lib/orders/field-config"
import { listContainer, fadeIn, springs } from "@/lib/motion"

// =============================================================================
// Tab Configuration
// =============================================================================

type TabKey = "all" | "needsInfo" | "pendingReview" | "approved" | "archived"

interface TabConfig {
  key: TabKey
  label: string
  filter: (order: Order) => boolean
}

const tabs: TabConfig[] = [
  { key: "all", label: "All", filter: (o) => o.status !== "archived" },
  { key: "needsInfo", label: "Needs Info", filter: (o) => o.status === "awaiting_clarification" },
  { key: "pendingReview", label: "Pending Review", filter: (o) => o.status === "waiting_review" },
  { key: "approved", label: "Approved", filter: (o) => o.status === "approved" },
  { key: "archived", label: "Archived", filter: (o) => o.status === "archived" },
]

// Status priority for sorting (lower number = higher priority, appears first)
const STATUS_PRIORITY: Record<string, number> = {
  awaiting_clarification: 1, // Needs Info
  waiting_review: 2,          // Pending Review
  approved: 3,
  archived: 4,
}

// =============================================================================
// Sub-components
// =============================================================================

interface TabButtonProps {
  tabKey: TabKey
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}

// Status-aligned badge colors for each tab (color only when active)
const tabBadgeColors: Record<TabKey, { active: string; inactive: string }> = {
  all: {
    active: "bg-slate-100 text-slate-600",
    inactive: "bg-slate-100/50 text-slate-400",
  },
  needsInfo: {
    active: "bg-orange-100 text-orange-700",
    inactive: "bg-slate-200/50 text-slate-500",
  },
  pendingReview: {
    active: "bg-blue-100 text-blue-700",
    inactive: "bg-slate-200/50 text-slate-500",
  },
  approved: {
    active: "bg-green-100 text-green-700",
    inactive: "bg-slate-200/50 text-slate-500",
  },
  archived: {
    active: "bg-slate-100 text-slate-600",
    inactive: "bg-slate-200/50 text-slate-500",
  },
}

function TabButton({ tabKey, label, count, isActive, onClick }: TabButtonProps) {
  const badgeColor = isActive ? tabBadgeColors[tabKey].active : tabBadgeColors[tabKey].inactive

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
        transition-colors duration-150
        ${isActive
          ? "text-slate-900"
          : "text-slate-500 hover:text-slate-700"
        }
      `}
    >
      {/* Animated background indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTabBackground"
          className="absolute inset-0 bg-white rounded-lg shadow-sm"
          transition={springs.subtle}
        />
      )}
      <span className="relative z-10">{label}</span>
      <span className={`
        relative z-10 px-2 py-0.5 text-xs font-medium rounded-full transition-colors duration-150
        ${badgeColor}
      `}>
        {count}
      </span>
    </button>
  )
}

function EmptyState({ tab }: { tab: TabKey }) {
  const configs: Record<TabKey, { icon: typeof CheckCircle; title: string; description: string }> = {
    all: {
      icon: CheckCircle,
      title: "No orders yet",
      description: "Orders will appear here when they're received.",
    },
    needsInfo: {
      icon: CheckCircle,
      title: "No incomplete orders",
      description: "Orders needing clarification will appear here.",
    },
    pendingReview: {
      icon: CheckCircle,
      title: "All caught up!",
      description: "No orders pending review at the moment.",
    },
    approved: {
      icon: Clock,
      title: "No approved orders yet",
      description: "Approved orders will appear here once processed.",
    },
    archived: {
      icon: Archive,
      title: "No archived orders",
      description: "Archived orders will appear here.",
    },
  }

  const config = configs[tab]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-32 px-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{config.title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm">{config.description}</p>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface OrdersListProps {
  initialOrders: Order[]
  initialStats: OrderStats
  orgRequiredFields: OrgRequiredField[]
}

export function OrdersList({ initialOrders, initialStats, orgRequiredFields }: OrdersListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("peek")
  const [showAddModal, setShowAddModal] = useState(false)
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const router = useRouter()
  const { toast } = useToast()

  // Derive active order from ID
  const activeOrder = useMemo(() => {
    if (!activeOrderId) return null
    return initialOrders.find(o => o.id === activeOrderId) ?? null
  }, [activeOrderId, initialOrders])

  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Set up real-time subscription for automation updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          setLastUpdated(new Date())
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Filter and sort orders based on search and active tab
  const filteredOrders = initialOrders
    .filter((order) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = (
          (order.company_name || "").toLowerCase().includes(searchLower) ||
          (order.order_number || "").toLowerCase().includes(searchLower)
        )
        if (!matchesSearch) return false
      }

      // Tab filter
      const tabConfig = tabs.find(t => t.key === activeTab)
      return tabConfig ? tabConfig.filter(order) : true
    })
    .sort((a, b) => {
      // Sort by status priority first (Needs Info > Pending Review > Approved > Archived)
      const priorityA = STATUS_PRIORITY[a.status] ?? 99
      const priorityB = STATUS_PRIORITY[b.status] ?? 99
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      // Within same status, sort by received_date (newest first)
      return new Date(b.received_date).getTime() - new Date(a.received_date).getTime()
    })

  // Get counts for each tab
  const tabCounts = tabs.reduce((acc, tab) => {
    const searchFiltered = initialOrders.filter((order) => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      return (
        (order.company_name || "").toLowerCase().includes(searchLower) ||
        (order.order_number || "").toLowerCase().includes(searchLower)
      )
    })
    acc[tab.key] = searchFiltered.filter(tab.filter).length
    return acc
  }, {} as Record<TabKey, number>)

  // Orders to display (limited by displayCount for infinite scroll)
  const displayedOrders = filteredOrders.slice(0, displayCount)
  const hasMore = displayCount < filteredOrders.length

  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting && hasMore && !isLoadingMore) {
      setIsLoadingMore(true)
      // Simulate loading delay for smoother UX
      setTimeout(() => {
        setDisplayCount(prev => prev + 20)
        setIsLoadingMore(false)
      }, 300)
    }
  }, [hasMore, isLoadingMore])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    })

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleObserver])

  // Reset display count when tab or search changes
  useEffect(() => {
    setDisplayCount(20)
  }, [activeTab, searchTerm])

  // Format "Updated X minutes ago"
  const getTimeAgo = () => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000 / 60)
    if (diff < 1) return "Updated just now"
    if (diff === 1) return "Updated 1 minute ago"
    return `Updated ${diff} minutes ago`
  }

  // Panel handlers
  const handleOrderClick = (order: Order) => {
    setActiveOrderId(order.id)
    setPanelMode("peek")
  }

  const handleClosePanel = () => {
    setActiveOrderId(null)
    setPanelMode("peek")
  }

  // Action handlers - same as before
  const handleSave = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields,
    deletedItems?: EditableItemInput[]
  ) => {
    try {
      // Extract IDs from deleted items to pass to the server action
      const deletedItemIds = deletedItems
        ?.filter(item => !item.isNew && item.id)
        .map(item => item.id) || []
      await saveOrderChanges(orderId, items, orderFields, deletedItemIds)
      toast({
        title: "Success",
        description: "Order saved successfully",
      })
    } catch (error) {
      console.error("Failed to save order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save order",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleSaveAndApprove = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields,
    customApprovalEmail?: string,
    deletedItems?: EditableItemInput[]
  ) => {
    try {
      await saveAndApproveOrder(orderId, items, orderFields, customApprovalEmail, deletedItems)
      toast({
        title: "Success",
        description: "Order saved and approved",
      })
    } catch (error) {
      console.error("Failed to save and approve order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save and approve order",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleRejectClick = (order: Order) => {
    setRejectingOrder(order)
  }

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectingOrder) return
    try {
      await rejectOrder(rejectingOrder.id, reason)
      toast({
        title: "Order Rejected",
        description: "The order has been removed",
      })
      setRejectingOrder(null)
    } catch (error) {
      console.error("Failed to reject order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject order",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleApprove = async (orderId: string) => {
    try {
      await approveOrder(orderId)
      toast({
        title: "Order Approved",
        description: "The order has been approved",
      })
    } catch (error) {
      console.error("Failed to approve order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve order",
        variant: "destructive",
      })
    }
  }

  const handleRequestInfo = async (orderId: string) => {
    try {
      await requestOrderInfo(orderId)
      toast({
        title: "Request Sent",
        description: "Clarification email has been sent to the customer",
      })
    } catch (error) {
      console.error("Failed to send clarification request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send clarification request",
        variant: "destructive",
      })
    }
  }

  const handleSaveAndAnalyze = async (
    orderId: string,
    items: EditableItemInput[],
    orderFields: OrderFieldsWithOrgFields,
    deletedItems?: EditableItemInput[]
  ): Promise<SaveAndAnalyzeResult> => {
    try {
      // Extract IDs from deleted items to pass to the server action
      const deletedItemIds = deletedItems
        ?.filter(item => !item.isNew && item.id)
        .map(item => item.id) || []
      const result = await saveAndAnalyzeOrder(orderId, items, orderFields, deletedItemIds)
      toast({
        title: "Changes Saved",
        description: result.isComplete
          ? "Order is now complete and ready for review"
          : "Order saved. Still missing some information.",
      })
      return result
    } catch (error) {
      console.error("Failed to save and analyze order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save order",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleRequestInfoWithMessage = async (orderId: string, clarificationMessage: string) => {
    try {
      await requestOrderInfo(orderId, clarificationMessage)
      toast({
        title: "Request Sent",
        description: "Clarification email has been sent to the customer",
      })
    } catch (error) {
      console.error("Failed to send clarification request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send clarification request",
        variant: "destructive",
      })
      throw error
    }
  }

  const handleSaveClarificationMessage = async (orderId: string, message: string) => {
    try {
      await saveClarificationMessage(orderId, message)
      toast({
        title: "Saved",
        description: "Clarification message saved for later",
      })
    } catch (error) {
      console.error("Failed to save clarification message:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save clarification message",
        variant: "destructive",
      })
      throw error
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <main className="flex-1 overflow-y-auto pl-60">
        <div className="w-full px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">Orders</h1>
            <p className="text-[14px] text-slate-500 mt-1">AI-powered order processing and management</p>
            <p className="text-[12px] text-slate-400 mt-1">{getTimeAgo()}</p>
          </div>

          {/* Tabs and Search */}
          <div className="flex items-center justify-between mb-6">
            <div className="bg-slate-100/80 rounded-xl p-1.5 inline-flex">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.key}
                  tabKey={tab.key}
                  label={tab.label}
                  count={tabCounts[tab.key]}
                  isActive={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-white/60"
                />
              </div>
              <Button
                onClick={() => setShowAddModal(true)}
                className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium shadow-sm gap-0 leading-none"
              >
                <Plus className="h-3.5 w-3.5 -mt-px" />
                Add Order
              </Button>
            </div>
          </div>

          {/* Orders List */}
          <AnimatePresence mode="wait">
            {displayedOrders.length === 0 ? (
              <motion.div
                key="empty"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeIn}
              >
                <EmptyState tab={activeTab} />
              </motion.div>
            ) : (
              <motion.div
                key={`list-${activeTab}`}
                className="space-y-3"
                initial="hidden"
                animate="visible"
                variants={listContainer}
              >
                {displayedOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onClick={() => handleOrderClick(order)}
                    onRejectClick={handleRejectClick}
                    onApprove={handleApprove}
                    onRequestInfo={handleRequestInfo}
                    orgRequiredFields={orgRequiredFields}
                  />
                ))}

                {/* Loading more indicator */}
                {isLoadingMore && (
                  <motion.div
                    className="space-y-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                  </motion.div>
                )}

                {/* Infinite scroll trigger */}
                {hasMore && !isLoadingMore && (
                  <div ref={loadMoreRef} className="h-4" />
                )}

                {/* End of list indicator */}
                {!hasMore && displayedOrders.length > 0 && (
                  <motion.p
                    className="text-center text-sm text-slate-400 py-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.15 }}
                  >
                    Showing all {filteredOrders.length} orders
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Order Edit Panel */}
      <OrderEditPanel
        order={activeOrder}
        isOpen={activeOrderId !== null}
        onClose={handleClosePanel}
        mode={panelMode}
        onModeChange={setPanelMode}
        onSave={handleSave}
        onSaveAndApprove={handleSaveAndApprove}
        onSaveAndAnalyze={handleSaveAndAnalyze}
        onRequestInfo={handleRequestInfoWithMessage}
        onSaveClarificationMessage={handleSaveClarificationMessage}
        orgRequiredFields={orgRequiredFields}
      />

      {/* Add Order Modal */}
      <AddOrderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => {
          setShowAddModal(false)
          router.refresh()
        }}
      />

      <RejectOrderModal
        isOpen={rejectingOrder !== null}
        onClose={() => setRejectingOrder(null)}
        onConfirm={handleRejectConfirm}
        orderNumber={rejectingOrder?.order_number}
      />
    </div>
  )
}
