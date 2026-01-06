import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function ProductRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="h-4 w-16 ml-auto" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8 rounded" />
      </TableCell>
    </TableRow>
  )
}

export default function ProductsLoading() {
  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <main className="flex-1 overflow-y-auto pl-60">
        <div className="w-full px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-6">
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>

          {/* Header Actions */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Skeleton className="h-10 w-80 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28 rounded-md" />
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>

          {/* Products Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array(10).fill(0).map((_, i) => (
                  <ProductRowSkeleton key={i} />
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Summary */}
          <div className="mt-4">
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </main>
    </div>
  )
}
