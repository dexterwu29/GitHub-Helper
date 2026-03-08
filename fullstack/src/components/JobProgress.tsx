'use client'

import type { JobDetail } from '@/lib/api'
import { JOB_STATUS_MAP } from '@/lib/constants'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

interface JobProgressProps {
  job: JobDetail
}

export default function JobProgress({ job }: JobProgressProps) {
  const { status, items } = job
  const total = items.length || 1

  const pending = items.filter((i) => i.status === 'pending').length
  const running = items.filter((i) => i.status === 'running').length
  const success = items.filter((i) => i.status === 'completed').length
  const failed = items.filter((i) => i.status === 'failed').length

  const successPercent = (success / total) * 100
  const failedPercent = (failed / total) * 100
  const runningPercent = (running / total) * 100

  const statusInfo = JOB_STATUS_MAP[status] || { label: status, color: 'badge-neutral' }

  const firstError = items.find((i) => i.errorMessage)?.errorMessage

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-surface-900">
          任务 #{job.id.slice(-6)}
        </h3>
        <span className={statusInfo.color}>{statusInfo.label}</span>
      </div>

      <div>
        <div className="h-2.5 bg-surface-100 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${successPercent}%` }}
          />
          <div
            className="bg-brand-500 transition-all duration-500"
            style={{ width: `${runningPercent}%` }}
          />
          <div
            className="bg-red-400 transition-all duration-500"
            style={{ width: `${failedPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatBox icon={<Clock className="w-4 h-4 text-surface-400" />} label="等待" value={pending} />
        <StatBox icon={<Loader2 className="w-4 h-4 text-sky-500 animate-spin" />} label="进行" value={running} />
        <StatBox icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="成功" value={success} />
        <StatBox icon={<XCircle className="w-4 h-4 text-red-400" />} label="失败" value={failed} />
      </div>

      {firstError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{firstError}</p>
        </div>
      )}
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 bg-surface-50 rounded-lg px-3 py-2">
      {icon}
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm font-semibold text-surface-800">{value}</p>
      </div>
    </div>
  )
}
