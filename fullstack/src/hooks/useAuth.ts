'use client'

import { useEffect, useState, useCallback } from 'react'
import { auth, type User, ApiError } from '@/lib/api'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const u = await auth.me()
      setUser(u)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    await auth.logout()
    setUser(null)
    window.location.href = '/'
  }, [])

  return { user, loading, logout, refetch: fetchUser }
}
