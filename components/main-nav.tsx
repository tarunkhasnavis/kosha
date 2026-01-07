"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Young_Serif } from "next/font/google"
import {
  ShoppingCart,
  Package,
  ChevronDown,
  Shield,
  Check,
  Loader2,
  MessageCircleWarning,
  Settings,
  LogOut,
  Building2,
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
import { switchOrganization } from "@/lib/organizations/actions"
import { ReportIssueModal } from "@/components/ReportIssueModal"
import { createClient } from "@/utils/supabase/client"

const youngSerif = Young_Serif({ weight: "400", subsets: ["latin"] })

const navigation = [
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Products", href: "/products", icon: Package },
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
  userId?: string | null
  userEmail?: string | null
}

export function MainNav({
  organizationName,
  isSuperAdmin,
  isOverride,
  currentOrgId,
  allOrganizations = [],
  userId,
  userEmail,
}: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSwitching, setIsSwitching] = useState(false)
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false)

  const handleSwitchOrg = async (orgId: string | null) => {
    setIsSwitching(true)
    await switchOrganization(orgId)
    router.refresh()
    setIsSwitching(false)
  }

  return (
    <nav className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-[rgba(15,23,42,0.06)] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-6">
        <Link href="/orders">
          <span className={`text-[22px] text-slate-900 ${youngSerif.className}`}>kosha</span>
        </Link>
        {isSuperAdmin && (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        )}
      </div>

      {/* Super Admin Org Switcher */}
      {isSuperAdmin && allOrganizations.length > 0 && (
        <div className="px-3 py-3 border-b border-[rgba(15,23,42,0.06)] bg-purple-50/30">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-purple-200 hover:border-purple-300 transition-colors duration-150 cursor-pointer" disabled={isSwitching}>
              {isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              ) : (
                <Shield className="h-4 w-4 text-purple-600" />
              )}
              <span className="flex-1 text-left text-sm font-medium text-slate-900 truncate">
                {isOverride ? organizationName : "Select Organization"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
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
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Organization Name - above divider */}
      {organizationName && (
        <div className="mx-3 pb-3">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-[14px] font-semibold text-slate-700 truncate">
              {organizationName}
            </span>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mx-3 px-0 pb-3 border-t border-[rgba(15,23,42,0.06)] pt-3">
        <div className="space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150",
              pathname === "/settings" || pathname?.startsWith("/settings/")
                ? "bg-slate-100 text-slate-900"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <button
            onClick={() => setIsReportIssueOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          >
            <MessageCircleWarning className="h-4 w-4" />
            Report an issue
          </button>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Report Issue Modal */}
      <ReportIssueModal
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        userId={userId}
        userEmail={userEmail}
        orgId={currentOrgId}
        orgName={organizationName}
      />
    </nav>
  )
}
