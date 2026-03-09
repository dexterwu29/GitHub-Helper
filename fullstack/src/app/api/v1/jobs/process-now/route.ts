import { NextResponse } from 'next/server'
import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'

/** 用户手动触发任务处理（生产环境替代 Vercel Cron 的本地触发） */
export async function POST() {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const base = process.env.APP_BASE_URL || 'http://localhost:3800'
  const secret = process.env.CRON_SECRET
  const res = await fetch(`${base}/api/cron/process-jobs`, {
    method: 'GET',
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(
      { code: 1, message: data.error || '处理失败' },
      { status: res.status }
    )
  }

  return ok({ ok: true, processed: data.processed ?? 0 })
}
