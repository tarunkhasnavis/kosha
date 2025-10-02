"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  ChefHat,
  Factory,
  Layers,
  Users,
  ShoppingCart,
} from "lucide-react"

const navigation = [
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ingredients", href: "/ingredients", icon: Package },
  { name: "Recipes", href: "/recipes", icon: ChefHat },
  { name: "Batches", href: "/batches", icon: Layers },
  { name: "Production", href: "/production", icon: Factory },
  { name: "Suppliers", href: "/suppliers", icon: Users },
]

export function MainNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <Package className="h-8 w-8 text-blue-600" />
        <span className="ml-2 text-xl font-bold text-gray-900">Zoodl</span>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
