'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  History,
  GitPullRequest,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import {
  jobs as jobsApi,
  pullRequests as prApi,
  type JobSummary,
  type JobDetail,
  type PullRequest,
} from '@/lib/api'
import { JOB_STATUS_MAP, POLL_INTERVAL_MS } from '@/lib/constants'
import JobProgress from '@/components/JobProgress'
import LoadingSpinner from '@/components/LoadingSpinner'

type Tab = 'jobs' | 'prs'

export default function JobsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId: repoIdStr } = use(params)
  const repoId = parseInt(repoIdStr, 10)

  const [tab, setTab] = useState<Tab>('jobs')
  const [loading, setLoading] = useState(true)

  // Jobs state
  const [jobList, setJobList] = useState<JobSummary[]>([])
  const [jobPage, setJobPage] = useState(1)
  const [jobTotal, setJobTotal] = useState(0)
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // PR state
  const [prList, setPrList] = useState<PullRequest[]>([])
  const [prPage, setPrPage] = useState(1)
  const [prTotal, setPrTotal] = useState(0)

  const pageSize = 10
  const jobTotalPages = Math.ceil(jobTotal / pageSize)
  const prTotalPages = Math.ceil(prTotal / pageSize)

  const loadJobs = async (page: number) => {
    try {
      const res = await jobsApi.list(repoId, page, pageSize)
      setJobList(res.items)
      setJobTotal(res.total)
    } catch {
      // ignore
    }
  }

  const loadPRs = async (page: number) => {
    try {
      const res = await prApi.list(repoId, page, pageSize)
      setPrList(res.items)
      setPrTotal(res.total)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    Promise.all([loadJobs(1), loadPRs(1)]).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  // Polling for in-progress jobs
  useEffect(() => {
    const hasRunning = jobList.some((j) => j.status === 'pending' || j.status === 'running')
    if (!hasRunning) return

    const timer = setInterval(() => loadJobs(jobPage), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobList, jobPage])

  // Polling for selected job detail
  useEffect(() => {
    if (!selectedJob) return
    const terminal = ['success', 'failed', 'partial_success', 'cancelled']
    if (terminal.includes(selectedJob.status)) return

    const timer = setInterval(async () => {
      try {
        const updated = await jobsApi.get(selectedJob.jobId)
        setSelectedJob(updated)
        if (terminal.includes(updated.status)) clearInterval(timer)
      } catch {
        clearInterval(timer)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [selectedJob])

  const openJobDetail = async (jobId: number) => {
    setDetailLoading(true)
    try {
      const detail = await jobsApi.get(jobId)
      setSelectedJob(detail)
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRetry = async () => {
    if (!selectedJob) return
    try {
      await jobsApi.retry(selectedJob.jobId)
      const updated = await jobsApi.get(selectedJob.jobId)
      setSelectedJob(updated)
      loadJobs(jobPage)
    } catch {
      // ignore
    }
  }

  const handleCancel = async (jobId: number) => {
    try {
      await jobsApi.cancel(jobId)
      loadJobs(jobPage)
    } catch {
      // ignore
    }
  }

  if (loading) return <LoadingSpinner text="加载任务数据..." />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/repos/${repoId}`} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-surface-900">任务与 PR</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200">
        <button
          onClick={() => setTab('jobs')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === 'jobs'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <History className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          翻译任务 ({jobTotal})
        </button>
        <button
          onClick={() => setTab('prs')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            tab === 'prs'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <GitPullRequest className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Pull Requests ({prTotal})
        </button>
      </div>

      {/* Jobs tab */}
      {tab === 'jobs' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            {jobList.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-surface-400">暂无翻译任务</p>
              </div>
            ) : (
              jobList.map((job) => {
                const st = JOB_STATUS_MAP[job.status] || JOB_STATUS_MAP.pending
                return (
                  <div key={job.jobId} className="card-hover p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${st.dotColor}`} />
                        <div>
                          <p className="text-sm font-medium text-surface-800">
                            任务 #{job.jobId}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className={`text-xs font-medium ${st.textColor}`}>{st.label}</span>
                            <span className="text-xs text-surface-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(job.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(job.status === 'pending' || job.status === 'running') && (
                          <button
                            onClick={() => handleCancel(job.jobId)}
                            className="btn-ghost text-xs text-red-500 hover:text-red-700"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            取消
                          </button>
                        )}
                        <button
                          onClick={() => openJobDetail(job.jobId)}
                          className="btn-secondary text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          详情
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {jobTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => { setJobPage((p) => p - 1); loadJobs(jobPage - 1) }}
                  disabled={jobPage <= 1}
                  className="btn-ghost p-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-surface-500">{jobPage} / {jobTotalPages}</span>
                <button
                  onClick={() => { setJobPage((p) => p + 1); loadJobs(jobPage + 1) }}
                  disabled={jobPage >= jobTotalPages}
                  className="btn-ghost p-1.5"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Job detail panel */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-surface-800 mb-3">任务详情</h3>
            {detailLoading ? (
              <LoadingSpinner text="加载中..." className="py-8" />
            ) : selectedJob ? (
              <div className="space-y-3">
                <JobProgress job={selectedJob} />
                {selectedJob.pr && (
                  <a
                    href={selectedJob.pr.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm w-full justify-center"
                  >
                    <GitPullRequest className="w-4 h-4" />
                    查看 PR #{selectedJob.pr.prNumber}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {(selectedJob.status === 'failed' || selectedJob.status === 'partial_success') && (
                  <button onClick={handleRetry} className="btn-secondary text-sm w-full">
                    <RefreshCw className="w-4 h-4" />
                    重试失败项
                  </button>
                )}
              </div>
            ) : (
              <div className="card p-5 text-center">
                <p className="text-sm text-surface-400">点击左侧任务查看详情</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRs tab */}
      {tab === 'prs' && (
        <div className="space-y-3">
          {prList.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-surface-400">暂无 Pull Request</p>
            </div>
          ) : (
            prList.map((pr) => (
              <a
                key={pr.id}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block card-hover p-4 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitPullRequest
                      className={`w-5 h-5 ${
                        pr.status === 'merged'
                          ? 'text-purple-500'
                          : pr.status === 'open'
                            ? 'text-emerald-500'
                            : 'text-surface-400'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-surface-800">{pr.title}</p>
                      <p className="text-xs text-surface-400 mt-0.5">
                        #{pr.prNumber} · {new Date(pr.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        pr.status === 'merged'
                          ? 'bg-purple-50 text-purple-600'
                          : pr.status === 'open'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-surface-100 text-surface-500'
                      }`}
                    >
                      {pr.status === 'merged' ? '已合并' : pr.status === 'open' ? '待审查' : '已关闭'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-surface-300" />
                  </div>
                </div>
              </a>
            ))
          )}

          {prTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => { setPrPage((p) => p - 1); loadPRs(prPage - 1) }}
                disabled={prPage <= 1}
                className="btn-ghost p-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-surface-500">{prPage} / {prTotalPages}</span>
              <button
                onClick={() => { setPrPage((p) => p + 1); loadPRs(prPage + 1) }}
                disabled={prPage >= prTotalPages}
                className="btn-ghost p-1.5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
