'use client'

import type { JobDetail } from '@/lib/api'
import { JOB_STATUS_MAP } from '@/lib/constants'
import { CheckCircle2, XCircle, Clock, Loader2, ExternalLink } from 'lucide-react'

interface JobProgressProps {
  job: JobDetail
}

export default function JobProgress({ job }: JobProgressProps) {
  const { progress, pr, status } = job
  const total = progress.total || 1
  const successPercent = (progress.success / total) * 100
  const failedPercent = (progress.failed / total) * 100
  const runningPercent = (progress.running / total) * 100

  const statusInfo = JOB_STATUS_MAP[status] || { label: status, color: 'badge-neutral' }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-surface-900">
            任务 #{job.jobId}
          </h3>
          <span className={statusInfo.color}>{statusInfo.label}</span>
        </div>
        {pr && (
          <a
            href={pr.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium cursor-pointer"
          >
            PR #{pr.prNumber}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
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
        <StatBox icon={<Clock className="w-4 h-4 text-surface-400" />} label="等待" value={progress.pending} />
        <StatBox icon={<Loader2 className="w-4 h-4 text-sky-500 animate-spin" />} label="进行" value={progress.running} />
        <StatBox icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="成功" value={progress.success} />
        <StatBox icon={<XCircle className="w-4 h-4 text-red-400" />} label="失败" value={progress.failed} />
      </div>

      {job.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">{job.errorMessage}</p>
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
