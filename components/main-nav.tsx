"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { Young_Serif } from "next/font/google"
import {
  ShoppingCart,
  Package,
  Building2,
  LogOut,
  Settings,
  ChevronDown,
  Shield,
  Check,
  Loader2,
  HelpCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { switchOrganization } from "@/lib/organizations/actions"

const youngSerif = Young_Serif({ weight: "400", subsets: ["latin"] })

const navigation = [
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Products", href: "/products", icon: Package },
]

const footerNavigation = [
  { name: "Help & Support", href: "/help", icon: HelpCircle },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface Organization {
  id: string
  name: string
  gmail_email: string | null
  created_at: string
}

interface MainNavProps {
  organizationName?: string
  isSuperAdmin?: boolean
  isOverride?: boolean
  currentOrgId?: string | null
  allOrganizations?: Organization[]
}

export function MainNav({
  organizationName,
  isSuperAdmin,
  isOverride,
  currentOrgId,
  allOrganizations = [],
}: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSwitchOrg = async (orgId: string | null) => {
    setIsSwitching(true)
    await switchOrganization(orgId)
    router.refresh()
    setIsSwitching(false)
  }

  return (
    <nav className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-[rgba(15,23,42,0.06)] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6">
        <Link href="/orders" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Kosha Logo" width={28} height={28} className="h-7 w-7" />
          <span className={`text-xl text-slate-900 ${youngSerif.className}`}>kosha</span>
        </Link>
        {isSuperAdmin && (
          <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-700 border-purple-200">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        )}
      </div>

      {/* Super Admin Org Switcher */}
      {isSuperAdmin && allOrganizations.length > 0 && (
        <div className="px-3 py-3 border-b border-[rgba(15,23,42,0.06)] bg-purple-50/30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-purple-200 hover:border-purple-300 transition-colors duration-150"
                disabled={isSwitching}
              >
                {isSwitching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                ) : (
                  <Shield className="h-4 w-4 text-purple-600" />
                )}
                <span className="flex-1 text-left text-sm font-medium text-slate-900 truncate">
                  {isOverride ? organizationName : "Select Organization"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch Organization
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allOrganizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{org.name}</span>
                    {org.gmail_email && (
                      <span className="text-xs text-muted-foreground">{org.gmail_email}</span>
                    )}
                  </div>
                  {currentOrgId === org.id && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </DropdownMenuItem>
              ))}
              {isOverride && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleSwitchOrg(null)}
                    className="text-purple-600 cursor-pointer"
                  >
                    Clear Override
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 rounded-full" />
                )}
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="px-3 pb-2 border-t border-[rgba(15,23,42,0.06)] pt-3">
        <div className="space-y-1">
          {footerNavigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Organization Dropdown at Bottom */}
      {organizationName && (
        <div className="p-3 border-t border-[rgba(15,23,42,0.06)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-150">
                <div className={cn(
                  "p-1.5 rounded-md",
                  isOverride ? "bg-purple-100" : "bg-slate-100"
                )}>
                  <Building2 className={cn(
                    "h-4 w-4",
                    isOverride ? "text-purple-700" : "text-slate-600"
                  )} />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-slate-900 truncate">
                  {organizationName}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </nav>
  )
}
