'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { deleteCustomer, reactivateCustomer } from '@/lib/customers/actions'
import { CustomerSlideOut } from './CustomerSlideOut'
import { CustomerModal } from './CustomerModal'
import type { Customer } from '@/types/customers'
import { formatCurrency, formatDate } from '@/lib/customers/services'

interface CustomersListProps {
  initialCustomers: Customer[]
}

export function CustomersList({ initialCustomers }: CustomersListProps) {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      (customer.primary_contact_email || '').toLowerCase().includes(searchLower) ||
      (customer.primary_contact_name || '').toLowerCase().includes(searchLower) ||
      (customer.customer_number || '').toLowerCase().includes(searchLower)
    )
  })

  const activeCustomers = filteredCustomers.filter(c => c.is_active)
  const inactiveCustomers = filteredCustomers.filter(c => !c.is_active)

  const handleCustomerCreated = (customer: Customer) => {
    setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)))
    setShowAddModal(false)
    toast({
      title: 'Customer Created',
      description: `${customer.name} has been added`,
    })
  }

  const handleCustomerUpdated = (customer: Customer) => {
    setCustomers(prev =>
      prev.map(c => c.id === customer.id ? customer : c).sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditingCustomer(null)
    // Also update selected customer if it's the one being edited
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(customer)
    }
    toast({
      title: 'Customer Updated',
      description: `${customer.name} has been updated`,
    })
  }

  const handleToggleActive = async (customer: Customer) => {
    if (customer.is_active) {
      // Deactivate via delete (which soft-deletes if has orders)
      const result = await deleteCustomer(customer.id)
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        if (result.deactivated) {
          setCustomers(prev =>
            prev.map(c => c.id === customer.id ? { ...c, is_active: false } : c)
          )
          toast({
            title: 'Customer Deactivated',
            description: `${customer.name} has been deactivated`,
          })
        } else {
          setCustomers(prev => prev.filter(c => c.id !== customer.id))
          toast({
            title: 'Customer Deleted',
            description: `${customer.name} has been deleted`,
          })
        }
      }
    } else {
      // Reactivate
      const result = await reactivateCustomer(customer.id)
      if (result.error) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        })
      } else {
        setCustomers(prev =>
          prev.map(c => c.id === customer.id ? { ...c, is_active: true } : c)
        )
        toast({
          title: 'Customer Reactivated',
          description: `${customer.name} has been reactivated`,
        })
      }
    }
  }

  const handleDelete = async () => {
    if (!deletingCustomer) return

    setIsDeleting(true)
    const result = await deleteCustomer(deletingCustomer.id)
    setIsDeleting(false)

    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      })
    } else {
      if (result.deactivated) {
        setCustomers(prev =>
          prev.map(c => c.id === deletingCustomer.id ? { ...c, is_active: false } : c)
        )
        toast({
          title: 'Customer Deactivated',
          description: `${deletingCustomer.name} has orders and was deactivated instead of deleted`,
        })
      } else {
        setCustomers(prev => prev.filter(c => c.id !== deletingCustomer.id))
        toast({
          title: 'Customer Deleted',
          description: `${deletingCustomer.name} has been deleted`,
        })
      }
    }
    setDeletingCustomer(null)
  }

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer)
  }

  return (
    <>
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name, email, or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/60"
          />
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium shadow-sm gap-0 leading-none"
        >
          <Plus className="h-3.5 w-3.5 -mt-px" />
          Add Customer
        </Button>
      </div>

      {/* Customers Table */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Users className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'No customers found' : 'No customers yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Add customers to track their orders and manage relationships.'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowAddModal(true)}
                className="h-10 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm font-medium shadow-sm gap-0 leading-none"
              >
                <Plus className="h-3.5 w-3.5 -mt-px" />
                Add Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Active customers first */}
              {activeCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => handleRowClick(customer)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      {customer.customer_number && (
                        <div className="text-xs text-slate-500">#{customer.customer_number}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.primary_contact_name && (
                      <div className="text-sm">{customer.primary_contact_name}</div>
                    )}
                    {customer.primary_contact_email && (
                      <div className="text-xs text-slate-500">{customer.primary_contact_email}</div>
                    )}
                    {!customer.primary_contact_name && !customer.primary_contact_email && (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {customer.total_orders}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(customer.total_spend)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(customer.last_order_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingCustomer(customer)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(customer)}>
                          <ToggleLeft className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingCustomer(customer)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {/* Inactive customers */}
              {inactiveCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="opacity-60 cursor-pointer hover:bg-slate-50"
                  onClick={() => handleRowClick(customer)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      {customer.customer_number && (
                        <div className="text-xs text-slate-500">#{customer.customer_number}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.primary_contact_name && (
                      <div className="text-sm">{customer.primary_contact_name}</div>
                    )}
                    {customer.primary_contact_email && (
                      <div className="text-xs text-slate-500">{customer.primary_contact_email}</div>
                    )}
                    {!customer.primary_contact_name && !customer.primary_contact_email && (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {customer.total_orders}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(customer.total_spend)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(customer.last_order_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300">
                      Inactive
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingCustomer(customer)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(customer)}>
                          <ToggleRight className="h-4 w-4 mr-2" />
                          Reactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingCustomer(customer)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Summary */}
      {filteredCustomers.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
          {inactiveCustomers.length > 0 && ` (${inactiveCustomers.length} inactive)`}
        </div>
      )}

      {/* Add/Edit Modal */}
      <CustomerModal
        isOpen={showAddModal || editingCustomer !== null}
        onClose={() => {
          setShowAddModal(false)
          setEditingCustomer(null)
        }}
        customer={editingCustomer}
        onCreated={handleCustomerCreated}
        onUpdated={handleCustomerUpdated}
      />

      {/* Customer Detail Slide-Out */}
      <CustomerSlideOut
        customer={selectedCustomer}
        isOpen={selectedCustomer !== null}
        onClose={() => setSelectedCustomer(null)}
        onEdit={() => {
          if (selectedCustomer) {
            setEditingCustomer(selectedCustomer)
          }
        }}
        onCustomerUpdated={handleCustomerUpdated}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deletingCustomer !== null} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingCustomer?.name}&quot;?
              {deletingCustomer && deletingCustomer.total_orders > 0 && (
                <span className="block mt-2 text-amber-600">
                  This customer has {deletingCustomer.total_orders} orders and will be deactivated instead.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Processing...' : deletingCustomer && deletingCustomer.total_orders > 0 ? 'Deactivate' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
