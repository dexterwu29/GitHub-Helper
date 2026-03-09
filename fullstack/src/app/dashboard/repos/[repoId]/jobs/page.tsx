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
} from 'lucide-react'
import {
  jobs as jobsApi,
  pullRequests as prApi,
  type JobSummary,
  type JobDetail,
  type PullRequestInfo,
} from '@/lib/api'
import { JOB_STATUS_MAP, POLL_INTERVAL_MS } from '@/lib/constants'
import JobProgress from '@/components/JobProgress'
import LoadingSpinner from '@/components/LoadingSpinner'

type Tab = 'jobs' | 'prs'

export default function JobsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params)

  const [tab, setTab] = useState<Tab>('jobs')
  const [loading, setLoading] = useState(true)

  const [jobList, setJobList] = useState<JobSummary[]>([])
  const [jobPage, setJobPage] = useState(1)
  const [jobTotal, setJobTotal] = useState(0)
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [prList, setPrList] = useState<PullRequestInfo[]>([])

  const pageSize = 10
  const jobTotalPages = Math.ceil(jobTotal / pageSize)

  const loadJobs = async (page: number) => {
    try {
      const res = await jobsApi.list(repoId, page, pageSize)
      setJobList(res.list)
      setJobTotal(res.total)
    } catch {
      // ignore
    }
  }

  const loadPRs = async () => {
    try {
      const list = await prApi.list(repoId)
      setPrList(list)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    Promise.all([loadJobs(1), loadPRs()]).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  useEffect(() => {
    const hasRunning = jobList.some((j) => j.status === 'pending' || j.status === 'running')
    if (!hasRunning) return
    const timer = setInterval(() => loadJobs(jobPage), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobList, jobPage])

  useEffect(() => {
    if (!selectedJob) return
    const terminal = ['completed', 'failed', 'partial', 'cancelled']
    if (terminal.includes(selectedJob.status)) return

    const timer = setInterval(async () => {
      try {
        const updated = await jobsApi.get(selectedJob.id)
        setSelectedJob(updated)
        if (terminal.includes(updated.status)) clearInterval(timer)
      } catch {
        clearInterval(timer)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [selectedJob])

  const openJobDetail = async (jobId: string) => {
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
      await jobsApi.retry(selectedJob.id)
      const updated = await jobsApi.get(selectedJob.id)
      setSelectedJob(updated)
      loadJobs(jobPage)
    } catch {
      // ignore
    }
  }

  const handleCancel = async (jobId: string) => {
    try {
      await jobsApi.cancel(jobId)
      loadJobs(jobPage)
    } catch {
      // ignore
    }
  }

  const [creatingPr, setCreatingPr] = useState(false)
  const [createPrError, setCreatePrError] = useState<string | null>(null)
  const handleCreatePr = async () => {
    if (!selectedJob) return
    setCreatingPr(true)
    setCreatePrError(null)
    try {
      const res = await jobsApi.createPr(selectedJob.id)
      const updated = await jobsApi.get(selectedJob.id)
      setSelectedJob(updated)
      loadPRs()
      if (res.prUrl) window.open(res.prUrl, '_blank')
    } catch (e) {
      setCreatePrError(e instanceof Error ? e.message : '创建 PR 失败')
    } finally {
      setCreatingPr(false)
    }
  }

  const [processing, setProcessing] = useState(false)
  const handleProcessNow = async () => {
    setProcessing(true)
    try {
      await jobsApi.processNow()
      await loadJobs(jobPage)
      if (selectedJob && (selectedJob.status === 'pending' || selectedJob.status === 'running')) {
        const updated = await jobsApi.get(selectedJob.id)
        setSelectedJob(updated)
      }
    } catch {
      // ignore
    } finally {
      setProcessing(false)
    }
  }

  const hasPendingJobs = jobList.some((j) => j.status === 'pending' || j.status === 'running')
  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  if (loading) return <LoadingSpinner text="加载任务数据..." />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/repos/${repoId}`} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-surface-900">任务与 PR</h1>
      </div>

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
          Pull Requests ({prList.length})
        </button>
      </div>

      {tab === 'jobs' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            {hasPendingJobs && (
              <div className="card p-3 bg-amber-50 border-amber-200">
                <p className="text-xs text-amber-800 mb-2">
                  {isLocalDev ? '本地开发：Vercel Cron 不会自动执行，请手动触发' : '有任务正在排队，点击立即处理'}
                </p>
                <button
                  onClick={handleProcessNow}
                  disabled={processing}
                  className="btn-primary text-sm"
                >
                  {processing ? '处理中...' : '立即处理排队任务'}
                </button>
              </div>
            )}
            {jobList.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-surface-400">暂无翻译任务</p>
              </div>
            ) : (
              jobList.map((job) => {
                const st = JOB_STATUS_MAP[job.status] || JOB_STATUS_MAP.pending
                return (
                  <div key={job.id} className="card-hover p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${st.dotColor}`} />
                        <div>
                          <p className="text-sm font-medium text-surface-800">
                            任务 #{job.id.slice(-6)}
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
                            onClick={() => handleCancel(job.id)}
                            className="btn-ghost text-xs text-red-500 hover:text-red-700"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            取消
                          </button>
                        )}
                        <button
                          onClick={() => openJobDetail(job.id)}
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
                  onClick={() => { const p = jobPage - 1; setJobPage(p); loadJobs(p) }}
                  disabled={jobPage <= 1}
                  className="btn-ghost p-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-surface-500">{jobPage} / {jobTotalPages}</span>
                <button
                  onClick={() => { const p = jobPage + 1; setJobPage(p); loadJobs(p) }}
                  disabled={jobPage >= jobTotalPages}
                  className="btn-ghost p-1.5"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-surface-800 mb-3">任务详情</h3>
            {detailLoading ? (
              <LoadingSpinner text="加载中..." className="py-8" />
            ) : selectedJob ? (
              <div className="space-y-3">
                <JobProgress job={selectedJob} />
                {(selectedJob.status === 'completed' || selectedJob.status === 'partial') &&
                  selectedJob.prs &&
                  selectedJob.prs.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                    <p className="text-sm text-emerald-800 font-medium">
                      PR 已创建，可在「PR」标签页查看或直接打开
                    </p>
                    <a
                      href={selectedJob.prs[0].prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      打开 PR
                    </a>
                  </div>
                )}
                {(selectedJob.status === 'completed' || selectedJob.status === 'partial') &&
                  selectedJob.completedItems > 0 &&
                  (!selectedJob.prs || selectedJob.prs.length === 0) && (
                  <div className="space-y-2">
                    <button
                      onClick={handleCreatePr}
                      disabled={creatingPr}
                      className="btn-primary text-sm w-full"
                    >
                      <GitPullRequest className="w-4 h-4" />
                      {creatingPr ? '创建中...' : '手动提交 PR'}
                    </button>
                    {createPrError && (
                      <p className="text-xs text-red-600">{createPrError}</p>
                    )}
                  </div>
                )}
                {(selectedJob.status === 'failed' || selectedJob.status === 'partial') && (
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
                href={pr.htmlUrl}
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
        </div>
      )}
    </div>
  )
}
