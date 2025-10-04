"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MainNav } from "@/components/main-nav"
import { Search, Plus, Edit, Trash2, Download, Filter, Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Supplier {
  id: string
  company_name: string
  contact_person: string
  email: string
  phone: string
  address: string
  status: 'active' | 'inactive' | 'pending'
  rating: number
  payment_terms: string
  lead_time_days: number
  created_at: string
}

// Mock supplier data
const mockSuppliers: Supplier[] = [
  {
    id: '1',
    company_name: "Baker's Supply Co",
    contact_person: "John Smith",
    email: "john@bakerssupply.com",
    phone: "+1-555-0123",
    address: "123 Industrial Ave, Food City, FC 12345",
    status: 'active',
    rating: 4.8,
    payment_terms: "Net 30",
    lead_time_days: 7,
    created_at: "2024-01-15"
  },
  {
    id: '2',
    company_name: "Fresh Dairy Farm",
    contact_person: "Sarah Johnson",
    email: "sarah@freshdairy.com",
    phone: "+1-555-0456",
    address: "456 Farm Road, Dairy Valley, DV 67890",
    status: 'active',
    rating: 4.2,
    payment_terms: "Net 15",
    lead_time_days: 3,
    created_at: "2024-01-20"
  },
  {
    id: '3',
    company_name: "Global Spice Trading",
    contact_person: "Mike Chen",
    email: "mike@globalspice.com",
    phone: "+1-555-0789",
    address: "789 Spice Street, Flavor Town, FT 13579",
    status: 'active',
    rating: 3.5,
    payment_terms: "Net 45",
    lead_time_days: 14,
    created_at: "2024-02-01"
  }
]

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers)
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>(mockSuppliers)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [newSupplier, setNewSupplier] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    status: "active" as const,
    rating: 5,
    payment_terms: "Net 30",
    lead_time_days: 7,
    notes: ""
  })


  // Filter suppliers based on search and status with null checks
  useEffect(() => {
    if (!suppliers || suppliers.length === 0) {
      setFilteredSuppliers([])
      return
    }

    let filtered = suppliers.filter(supplier => {
      if (!supplier) return false
      
      const searchMatch = searchTerm === "" || (
        (supplier.company_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (supplier.contact_person?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (supplier.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
      )

      const statusMatch = statusFilter === "all" || supplier.status === statusFilter

      return searchMatch && statusMatch
    })

    setFilteredSuppliers(filtered)
  }, [suppliers, searchTerm, statusFilter])

  const renderStars = (rating: number) => {
    if (!rating || isNaN(rating)) rating = 0
    
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }, (_, i) => (
          <Star key={`full-${i}`} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
        ))}
        
        {/* Half star with CSS clipping */}
        {hasHalfStar && (
          <div key="half" className="relative">
            <Star className="h-4 w-4 text-gray-300 fill-gray-300" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </div>
          </div>
        )}
        
        {/* Empty stars */}
        {Array.from({ length: emptyStars }, (_, i) => (
          <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300 fill-gray-300" />
        ))}
        
        <span className="text-xs text-gray-500 ml-1">({rating.toFixed(1)})</span>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    if (!status) status = 'pending'
    
    const variants = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800"
    }
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const handleAddSupplier = () => {
    if (!newSupplier.company_name.trim()) {
      alert('Company name is required')
      return
    }

    // Add to local state (mock functionality)
    const newSupplierData: Supplier = {
      ...newSupplier,
      id: Date.now().toString(),
      created_at: new Date().toISOString().split('T')[0]
    }
    setSuppliers(prev => [...prev, newSupplierData])
    
    // Reset form
    setNewSupplier({
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      status: "active",
      rating: 5,
      payment_terms: "Net 30",
      lead_time_days: 7,
      notes: ""
    })
    setIsAddDialogOpen(false)
  }

  const handleEditSupplier = (supplier: Supplier) => {
    if (!supplier.company_name.trim()) {
      alert('Company name is required')
      return
    }

    // Update local state (mock functionality)
    setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s))
    setEditingSupplier(null)
  }

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return
    
    // Remove from local state (mock functionality)
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  const exportToCSV = () => {
    const headers = ['Company Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Status', 'Rating', 'Payment Terms', 'Lead Time (Days)', 'Created Date']
    const csvContent = [
      headers.join(','),
      ...filteredSuppliers.map(supplier => [
        `"${supplier.company_name || ''}"`,
        `"${supplier.contact_person || ''}"`,
        `"${supplier.email || ''}"`,
        `"${supplier.phone || ''}"`,
        `"${supplier.address || ''}"`,
        supplier.status || '',
        supplier.rating || 0,
        `"${supplier.payment_terms || ''}"`,
        supplier.lead_time_days || 0,
        supplier.created_at || ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'suppliers.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }


  return (
    <div className="flex h-screen bg-gray-50">
      <MainNav />

      <main className="flex-1 ml-64 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your supplier relationships and vendor information ({filteredSuppliers.length} total)
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Supplier</DialogTitle>
                    <DialogDescription>
                      Enter the supplier information below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <Input
                        id="company_name"
                        value={newSupplier.company_name}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, company_name: e.target.value }))}
                        placeholder="Enter company name"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact_person">Contact Person</Label>
                      <Input
                        id="contact_person"
                        value={newSupplier.contact_person}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, contact_person: e.target.value }))}
                        placeholder="Enter contact person"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={newSupplier.address}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter full address"
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rating">Rating (0-5)</Label>
                      <Input
                        id="rating"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={newSupplier.rating}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, rating: parseFloat(e.target.value) || 0 }))}
                        placeholder="Enter rating (0-5)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payment_terms">Payment Terms</Label>
                      <Select value={newSupplier.payment_terms} onValueChange={(value) => setNewSupplier(prev => ({ ...prev, payment_terms: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment terms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="COD">COD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lead_time_days">Lead Time (Days)</Label>
                      <Input
                        id="lead_time_days"
                        type="number"
                        min="1"
                        value={newSupplier.lead_time_days}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, lead_time_days: parseInt(e.target.value) || 1 }))}
                        placeholder="Enter lead time in days"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newSupplier.notes}
                        onChange={(e) => setNewSupplier(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Enter any additional notes"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSupplier}>Add Supplier</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers ({filteredSuppliers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-48" />
                    <col className="w-32" />
                    <col className="w-48" />
                    <col className="w-32" />
                    <col className="w-64" />
                    <col className="w-20" />
                    <col className="w-32" />
                    <col className="w-24" />
                    <col className="w-20" />
                    <col className="w-20" />
                  </colgroup>
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900 truncate" title={supplier.company_name || ''}>
                            {supplier.company_name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 truncate" title={supplier.contact_person || ''}>
                            {supplier.contact_person || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 truncate" title={supplier.email || ''}>
                            {supplier.email || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 whitespace-nowrap">
                            {supplier.phone || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 truncate" title={supplier.address || ''}>
                            {supplier.address || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {getStatusBadge(supplier.status)}
                        </td>
                        <td className="px-4 py-4">
                          {renderStars(supplier.rating)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 whitespace-nowrap">
                            {supplier.payment_terms || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 whitespace-nowrap">
                            {supplier.lead_time_days || 0} days
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSupplier(supplier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredSuppliers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== "all" 
                      ? "No suppliers found matching your criteria." 
                      : "No suppliers found. Add your first supplier to get started."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Supplier Dialog */}
        {editingSupplier && (
          <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
                <DialogDescription>
                  Update the supplier information below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit_company_name">Company Name *</Label>
                  <Input
                    id="edit_company_name"
                    value={editingSupplier.company_name || ''}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                    placeholder="Enter company name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_contact_person">Contact Person</Label>
                  <Input
                    id="edit_contact_person"
                    value={editingSupplier.contact_person || ''}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, contact_person: e.target.value } : null)}
                    placeholder="Enter contact person"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_email">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    value={editingSupplier.email || ''}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, email: e.target.value } : null)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input
                    id="edit_phone"
                    value={editingSupplier.phone || ''}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_address">Address</Label>
                  <Textarea
                    id="edit_address"
                    value={editingSupplier.address || ''}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="Enter full address"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_rating">Rating (0-5)</Label>
                  <Input
                    id="edit_rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editingSupplier.rating || 0}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, rating: parseFloat(e.target.value) || 0 } : null)}
                    placeholder="Enter rating (0-5)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select value={editingSupplier.status} onValueChange={(value: 'active' | 'inactive' | 'pending') => setEditingSupplier(prev => prev ? { ...prev, status: value } : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_payment_terms">Payment Terms</Label>
                  <Select value={editingSupplier.payment_terms} onValueChange={(value) => setEditingSupplier(prev => prev ? { ...prev, payment_terms: value } : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="COD">COD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit_lead_time_days">Lead Time (Days)</Label>
                  <Input
                    id="edit_lead_time_days"
                    type="number"
                    min="1"
                    value={editingSupplier.lead_time_days || 1}
                    onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, lead_time_days: parseInt(e.target.value) || 1 } : null)}
                    placeholder="Enter lead time in days"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingSupplier(null)}>
                  Cancel
                </Button>
                <Button onClick={() => editingSupplier && handleEditSupplier(editingSupplier)}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  )
}
