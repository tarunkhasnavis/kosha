"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Young_Serif } from "next/font/google"
import {
  LayoutDashboard,
  Package,
  ChefHat,
  Factory,
  Layers,
  Users,
  ShoppingCart,
  Building2,
  LogOut,
} from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

const youngSerif = Young_Serif({ weight: "400", subsets: ["latin"] })

const navigation = [
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Ingredients", href: "/", icon: Package },
  { name: "Recipes", href: "/", icon: ChefHat },
  { name: "Batches", href: "/", icon: Layers },
  { name: "Production", href: "/", icon: Factory },
  { name: "Suppliers", href: "/", icon: Users },
]

interface MainNavProps {
  organizationName?: string
}

export function MainNav({ organizationName }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center px-3 border-b border-gray-200">
        <div>
          <Image src="/logo.png" alt="Kosha Logo" width={32} height={32} className="h-8 w-8" />
        </div>
        <span className={`text-xl text-gray-900 ${youngSerif.className}`}>kosha</span>
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
                  isActive ? "bg-green-50 text-[#48663D]" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Organization Name & Sign Out - Bottom */}
      {organizationName && (
        <div className="border-t border-gray-200 p-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Organization</p>
              <p className="text-sm font-medium text-gray-900 truncate">{organizationName}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
