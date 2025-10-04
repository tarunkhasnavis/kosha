"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Thermometer, Clock, User, MapPin } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface TemperatureRecord {
  id: string
  itemId: string
  itemName: string
  temperature: number
  location: string
  timestamp: string
  checkedBy: string
  context: string
  recommendation: string
  notes?: string
}

export function TemperatureHistory() {
  const { toast } = useToast()

  // Mock temperature history data
  const temperatureHistory: TemperatureRecord[] = [
    {
      id: "TEMP001",
      itemId: "INV003",
      itemName: "Fresh Milk",
      temperature: 3.2,
      location: "production-floor",
      timestamp: "2025-04-02T10:30:00Z",
      checkedBy: "John Smith",
      context: "production",
      recommendation: "keep",
      notes: "Temperature within range during production",
    },
    {
      id: "TEMP002",
      itemId: "INV004",
      itemName: "Cream Cheese",
      temperature: 6.8,
      location: "prep-area",
      timestamp: "2025-04-02T09:15:00Z",
      checkedBy: "Sarah Johnson",
      context: "production",
      recommendation: "move-to-cold",
      notes: "Temperature slightly elevated, moved to cold storage",
    },
    {
      id: "TEMP003",
      itemId: "INV010",
      itemName: "Fresh Eggs",
      temperature: 2.1,
      location: "receiving-dock",
      timestamp: "2025-04-02T08:45:00Z",
      checkedBy: "Mike Wilson",
      context: "inbound",
      recommendation: "keep",
      notes: "Inbound delivery temperature check - acceptable",
    },
    {
      id: "TEMP004",
      itemId: "INV005",
      itemName: "Strawberries",
      temperature: 8.5,
      location: "quality-lab",
      timestamp: "2025-04-02T07:20:00Z",
      checkedBy: "Lisa Chen",
      context: "inspection",
      recommendation: "urgent",
      notes: "Quality inspection - temperature rising, expedite processing",
    },
  ]

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case "keep":
        return <Badge className="bg-green-500">Keep</Badge>
      case "move-to-cold":
        return <Badge className="bg-red-500">Move to Cold</Badge>
      case "urgent":
        return <Badge className="bg-yellow-500">Urgent</Badge>
      default:
        return <Badge>{recommendation}</Badge>
    }
  }

  const getContextBadge = (context: string) => {
    switch (context) {
      case "production":
        return <Badge variant="outline">Production</Badge>
      case "inbound":
        return <Badge variant="outline">Inbound</Badge>
      case "inspection":
        return <Badge variant="outline">Inspection</Badge>
      default:
        return <Badge variant="outline">{context}</Badge>
    }
  }

  const handleExport = () => {
    const headers = ["Timestamp", "Item", "Temperature", "Location", "Checked By", "Context", "Recommendation", "Notes"]
    const csvContent = [
      headers.join(","),
      ...temperatureHistory.map((record) =>
        [
          new Date(record.timestamp).toLocaleString(),
          `"${record.itemName}"`,
          record.temperature,
          record.location,
          `"${record.checkedBy}"`,
          record.context,
          record.recommendation,
          `"${record.notes || ""}"`,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "temperature-history.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Complete",
      description: "Temperature history has been exported to CSV",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5" />
              Temperature Check History
            </CardTitle>
            <CardDescription>Complete history of all temperature checks and recommendations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Temperature</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Checked By</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Recommendation</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {temperatureHistory.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium">{new Date(record.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{record.itemName}</div>
                  <div className="text-xs text-gray-500">{record.itemId}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-blue-500" />
                    <span className="font-mono">{record.temperature}°C</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="capitalize">{record.location.replace("-", " ")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{record.checkedBy}</span>
                  </div>
                </TableCell>
                <TableCell>{getContextBadge(record.context)}</TableCell>
                <TableCell>{getRecommendationBadge(record.recommendation)}</TableCell>
                <TableCell>
                  <div className="max-w-xs truncate text-sm text-gray-600">{record.notes || "-"}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
