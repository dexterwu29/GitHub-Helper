'use client'

import Link from 'next/link'
import Image from 'next/image'
import { LogOut, Settings, LayoutDashboard, Globe } from 'lucide-react'
import type { User } from '@/lib/api'

interface NavbarProps {
  user: User | null
  onLogout?: () => void
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface-0/80 backdrop-blur-md border-b border-surface-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-surface-900 font-display">
              GitHub Helper
            </span>
          </Link>

          {user && (
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="btn-ghost text-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">仪表盘</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="btn-ghost text-sm"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">设置</span>
              </Link>

              <div className="ml-2 h-8 w-px bg-surface-200" />

              <div className="flex items-center gap-3 ml-2">
                <div className="flex items-center gap-2">
                  {user.avatarUrl && (
                    <Image
                      src={user.avatarUrl}
                      alt={user.githubLogin}
                      width={28}
                      height={28}
                      className="rounded-full ring-2 ring-surface-200"
                    />
                  )}
                  <span className="text-sm font-medium text-surface-700 hidden sm:inline">
                    {user.githubLogin}
                  </span>
                </div>
                <button onClick={onLogout} className="btn-ghost text-sm text-surface-500 hover:text-red-500" title="退出登录">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}
