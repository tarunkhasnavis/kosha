import { Skeleton, Card, CardContent, CardHeader, CardTitle } from "@kosha/ui"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen w-full">
      <main className="flex-1 overflow-auto md:pl-60">
        <div className="flex flex-col gap-4 p-4 md:gap-8 md:p-8">
          <Skeleton className="h-8 w-48" />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <Skeleton className="h-4 w-24" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
          </div>

          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-xs" />

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40 mb-1" />
                  <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40 mb-1" />
                  <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40 mb-1" />
                <Skeleton className="h-4 w-60" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-3 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-2 w-24 rounded-full" />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
