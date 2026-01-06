import { Skeleton } from "@/components/ui/skeleton"

function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-5 px-5 py-4 bg-white border border-[rgba(15,23,42,0.06)] rounded-lg animate-pulse">
      <div className="w-2 h-2 rounded-full bg-slate-200 ml-2" />
      <div className="h-4 w-28 bg-slate-200 rounded" />
      <div className="h-4 w-44 bg-slate-100 rounded" />
      <div className="w-8 h-8 bg-slate-100 rounded" />
      <div className="h-4 w-28 bg-slate-100 rounded" />
      <div className="h-4 w-20 bg-slate-100 rounded -mr-2" />
      <div className="h-4 w-24 bg-slate-100 rounded" />
      <div className="flex items-center gap-2 w-24 ml-6">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full" />
        <div className="h-3 w-8 bg-slate-100 rounded" />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <div className="h-8 w-20 bg-slate-100 rounded" />
        <div className="h-8 w-20 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

function TabSkeleton({ width }: { width: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${width}`}>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-5 w-8 rounded-full" />
    </div>
  )
}

export default function OrdersLoading() {
  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <main className="flex-1 overflow-y-auto pl-60">
        <div className="w-full px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Skeleton className="h-8 w-28 mb-2" />
              <Skeleton className="h-4 w-72 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-48 rounded-lg" />
          </div>

          {/* Tabs and Search */}
          <div className="flex items-center justify-between mb-6">
            <div className="bg-slate-100/80 rounded-xl p-1.5 inline-flex gap-1">
              <TabSkeleton width="w-16" />
              <TabSkeleton width="w-24" />
              <TabSkeleton width="w-32" />
              <TabSkeleton width="w-24" />
              <TabSkeleton width="w-24" />
            </div>
            <Skeleton className="h-10 w-64 rounded-lg" />
          </div>

          {/* Order rows */}
          <div className="space-y-3">
            {Array(8).fill(0).map((_, i) => (
              <OrderRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
