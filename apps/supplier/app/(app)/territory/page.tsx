import { Map } from 'lucide-react'

export default function TerritoryPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Territory</h1>

      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Map className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-muted-foreground">Territory coming soon</p>
      </div>
    </div>
  )
}
