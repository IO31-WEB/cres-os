'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Handshake,
  FileBarChart,
  FileText,
  DollarSign,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Priorities', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/properties', label: 'Properties', icon: MapPin },
  { href: '/deals', label: 'Deals', icon: Handshake },
  { href: '/scorecard', label: 'Scorecard', icon: FileBarChart },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/commissions', label: 'Commissions', icon: DollarSign },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Primary">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={onCloseMobile}
            className={cn(
              'group flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors',
              active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
            )}
          >
            <span
              className={cn(
                'h-4 w-[3px] shrink-0 rounded-full transition-colors',
                active ? 'bg-gold' : 'bg-transparent'
              )}
              aria-hidden
            />
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop — fixed column, always visible */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy md:flex">
        <div className="flex h-14 items-center px-5">
          <span className="text-sm font-semibold tracking-tight text-white">CRES Solutions OS</span>
        </div>
        {nav}
      </aside>

      {/* Mobile — off-canvas panel */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onCloseMobile}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-navy transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-14 items-center justify-between px-5">
            <span className="text-sm font-semibold tracking-tight text-white">CRES Solutions OS</span>
            <button
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {nav}
        </aside>
      </div>
    </>
  )
}

export { NAV_ITEMS }
