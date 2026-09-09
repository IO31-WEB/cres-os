'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { NAV_ITEMS } from '@/components/shell/sidebar'

interface TopbarProps {
  onOpenMobileNav: () => void
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const pathname = usePathname()
  const current = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-canvas px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-medium text-ink">{current?.label ?? 'CRES Solutions OS'}</h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  )
}
