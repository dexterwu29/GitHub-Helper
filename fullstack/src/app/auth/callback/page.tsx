'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errMsg = params.get('error')

    if (errMsg) {
      setError(errMsg)
      return
    }

    router.replace('/dashboard')
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-md text-center space-y-4">
          <p className="text-red-600 font-medium">登录失败</p>
          <p className="text-sm text-surface-500">{error}</p>
          <a href="/" className="btn-primary text-sm inline-flex">
            返回首页
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner text="正在完成登录..." />
    </div>
  )
}
