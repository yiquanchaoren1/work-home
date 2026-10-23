"use client"

import { useNavigate } from "react-router-dom"
import {
  Search,
  LayoutPanelLeft,
  LayoutDashboard,
  Mail,
  CheckSquare,
  MessageCircle,
  Calendar,
  Shield,
  AlertTriangle,
  Settings,
  HelpCircle,
  CreditCard,
  User,
  Bell,
  Link2,
  Palette,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

interface SearchItem {
  title: string
  url: string
  group: string
  icon?: LucideIcon
}

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const navigate = useNavigate()

  const searchItems: SearchItem[] = [
    // Dashboards
    {
      title: "Dashboard 1",
      url: "/dashboard",
      group: "Dashboards",
      icon: LayoutDashboard,
    },
    {
      title: "Dashboard 2",
      url: "/dashboard-2",
      group: "Dashboards",
      icon: LayoutPanelLeft,
    },

    // Apps
    { title: "Mail", url: "/mail", group: "Apps", icon: Mail },
    { title: "Tasks", url: "/tasks", group: "Apps", icon: CheckSquare },
    { title: "Chat", url: "/chat", group: "Apps", icon: MessageCircle },
    { title: "Calendar", url: "/calendar", group: "Apps", icon: Calendar },

    // Auth Pages
    {
      title: "Sign In 1",
      url: "/auth/sign-in",
      group: "Auth Pages",
      icon: Shield,
    },
    {
      title: "Sign In 2",
      url: "/auth/sign-in-2",
      group: "Auth Pages",
      icon: Shield,
    },
    {
      title: "Sign Up 1",
      url: "/auth/sign-up",
      group: "Auth Pages",
      icon: Shield,
    },
    {
      title: "Sign Up 2",
      url: "/auth/sign-up-2",
      group: "Auth Pages",
      icon: Shield,
    },
    {
      title: "Forgot Password 1",
      url: "/auth/forgot-password",
      group: "Auth Pages",
      icon: Shield,
    },
    {
      title: "Forgot Password 2",
      url: "/auth/forgot-password-2",
      group: "Auth Pages",
      icon: Shield,
    },

    // Errors
    {
      title: "Unauthorized",
      url: "/errors/unauthorized",
      group: "Errors",
      icon: AlertTriangle,
    },
    {
      title: "Forbidden",
      url: "/errors/forbidden",
      group: "Errors",
      icon: AlertTriangle,
    },
    {
      title: "Not Found",
      url: "/errors/not-found",
      group: "Errors",
      icon: AlertTriangle,
    },
    {
      title: "Internal Server Error",
      url: "/errors/internal-server-error",
      group: "Errors",
      icon: AlertTriangle,
    },
    {
      title: "Under Maintenance",
      url: "/errors/under-maintenance",
      group: "Errors",
      icon: AlertTriangle,
    },

    // Settings
    {
      title: "User Settings",
      url: "/settings/user",
      group: "Settings",
      icon: User,
    },
    {
      title: "Account Settings",
      url: "/settings/account",
      group: "Settings",
      icon: Settings,
    },
    {
      title: "Plans & Billing",
      url: "/settings/billing",
      group: "Settings",
      icon: CreditCard,
    },
    {
      title: "Appearance",
      url: "/settings/appearance",
      group: "Settings",
      icon: Palette,
    },
    {
      title: "Notifications",
      url: "/settings/notifications",
      group: "Settings",
      icon: Bell,
    },
    {
      title: "Connections",
      url: "/settings/connections",
      group: "Settings",
      icon: Link2,
    },

    // Pages
    { title: "FAQs", url: "/faqs", group: "Pages", icon: HelpCircle },
    { title: "Pricing", url: "/pricing", group: "Pages", icon: CreditCard },
  ]

  const groupedItems = searchItems.reduce(
    (acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = []
      }
      acc[item.group].push(item)
      return acc
    },
    {} as Record<string, SearchItem[]>
  )

  const handleSelect = (url: string) => {
    navigate(url)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Search"
      description="Search pages and settings"
      className="sm:max-w-[640px]"
    >
      <Command>
        <CommandInput placeholder="What do you need?" autoFocus />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(groupedItems).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.url}
                    value={item.title}
                    onSelect={() => handleSelect(item.url)}
                  >
                    {Icon && <Icon />}
                    {item.title}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative w-full justify-start font-normal text-muted-foreground sm:pr-12 md:w-36 lg:w-56"
    >
      <Search data-icon="inline-start" />
      Search...
      <Kbd className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 sm:inline-flex">
        ⌘K
      </Kbd>
    </Button>
  )
}
