'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Play,
  History,
  GitPullRequest,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import {
  repos as reposApi,
  jobs as jobsApi,
  keys as keysApi,
  type Repo,
  type RepoTree,
  type ApiKey,
  type JobDetail,
  ApiError,
} from '@/lib/api'
import { SUPPORTED_LANGUAGES, RUN_MODE_OPTIONS, JOB_STATUS_MAP, POLL_INTERVAL_MS } from '@/lib/constants'
import FileTree from '@/components/FileTree'
import JobProgress from '@/components/JobProgress'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function RepoDetailPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId: repoIdStr } = use(params)
  const repoId = parseInt(repoIdStr, 10)

  const [repo, setRepo] = useState<Repo | null>(null)
  const [tree, setTree] = useState<RepoTree | null>(null)
  const [userKeys, setUserKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Config form
  const [baseLanguage, setBaseLanguage] = useState('')
  const [targetLanguages, setTargetLanguages] = useState<string[]>([])
  const [readmeLinksEnabled, setReadmeLinksEnabled] = useState(true)
  const [runMode, setRunMode] = useState<'platform' | 'bring_your_key'>('platform')
  const [userApiKeyId, setUserApiKeyId] = useState<number | null>(null)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())

  // Job
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null)
  const [triggering, setTriggering] = useState(false)

  const loadRepo = useCallback(async () => {
    try {
      const list = await reposApi.list()
      const found = list.find((r) => r.id === repoId)
      if (found) {
        setRepo(found)
        if (found.config) {
          setBaseLanguage(found.config.baseLanguage)
          setTargetLanguages(found.config.targetLanguages)
          setReadmeLinksEnabled(found.config.readmeLinksEnabled)
          setRunMode(found.config.runMode)
        }
      }
    } catch {
      // ignore
    }
  }, [repoId])

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    try {
      const t = await reposApi.getTree(repoId)
      setTree(t)
      const tracked = await reposApi.getTrackedDocs(repoId)
      setSelectedDocs(new Set(tracked))
    } catch {
      // ignore
    } finally {
      setTreeLoading(false)
    }
  }, [repoId])

  useEffect(() => {
    Promise.all([loadRepo(), loadTree(), keysApi.list().then(setUserKeys).catch(() => {})]).finally(
      () => setLoading(false),
    )
  }, [loadRepo, loadTree])

  // Polling for active job
  useEffect(() => {
    if (!activeJob) return
    const terminal = ['success', 'failed', 'partial_success', 'cancelled']
    if (terminal.includes(activeJob.status)) return

    const timer = setInterval(async () => {
      try {
        const updated = await jobsApi.get(activeJob.jobId)
        setActiveJob(updated)
        if (terminal.includes(updated.status)) {
          clearInterval(timer)
        }
      } catch {
        clearInterval(timer)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [activeJob])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      await reposApi.saveConfig(repoId, {
        baseLanguage,
        targetLanguages,
        readmeLinksEnabled,
        runMode,
        userApiKeyId: runMode === 'bring_your_key' ? userApiKeyId : null,
      })
      await reposApi.saveTrackedDocs(repoId, Array.from(selectedDocs))
      setSaveMsg({ type: 'ok', text: '配置已保存' })
      await loadRepo()
    } catch (e) {
      setSaveMsg({ type: 'err', text: e instanceof ApiError ? e.message : '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const result = await jobsApi.trigger(repoId)
      const detail = await jobsApi.get(result.jobId)
      setActiveJob(detail)
    } catch (e) {
      setSaveMsg({ type: 'err', text: e instanceof ApiError ? e.message : '任务创建失败' })
    } finally {
      setTriggering(false)
    }
  }

  const handleRetry = async () => {
    if (!activeJob) return
    try {
      await jobsApi.retry(activeJob.jobId)
      const updated = await jobsApi.get(activeJob.jobId)
      setActiveJob(updated)
    } catch {
      // ignore
    }
  }

  const toggleDoc = (path: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleTarget = (lang: string) => {
    setTargetLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    )
  }

  if (loading) return <LoadingSpinner text="加载仓库信息..." />

  if (!repo) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-500">仓库未找到</p>
        <Link href="/dashboard" className="btn-primary text-sm mt-4 inline-flex">
          返回仪表盘
        </Link>
      </div>
    )
  }

  const canTrigger = !!baseLanguage && targetLanguages.length > 0 && selectedDocs.size > 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-surface-900">{repo.fullName}</h1>
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-400 hover:text-brand-500 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-surface-500">分支: {repo.defaultBranch}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/repos/${repoId}/jobs`} className="btn-secondary text-sm">
            <History className="w-4 h-4" />
            任务历史
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-5">
          {/* Language config */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-surface-800">翻译配置</h2>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">基准语言（源语言）</label>
              <select
                value={baseLanguage}
                onChange={(e) => setBaseLanguage(e.target.value)}
                className="input-field"
              >
                <option value="">请选择</option>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">目标语言（多选）</label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_LANGUAGES.filter((l) => l.code !== baseLanguage).map((l) => {
                  const active = targetLanguages.includes(l.code)
                  return (
                    <button
                      key={l.code}
                      onClick={() => toggleTarget(l.code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-150 cursor-pointer ${
                        active
                          ? 'bg-brand-50 text-brand-700 border-brand-300'
                          : 'bg-surface-0 text-surface-600 border-surface-200 hover:border-surface-300'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">调用模式</label>
                <select
                  value={runMode}
                  onChange={(e) => setRunMode(e.target.value as 'platform' | 'bring_your_key')}
                  className="input-field"
                >
                  {RUN_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {runMode === 'bring_your_key' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">选择 API Key</label>
                  <select
                    value={userApiKeyId ?? ''}
                    onChange={(e) => setUserApiKeyId(e.target.value ? Number(e.target.value) : null)}
                    className="input-field"
                  >
                    <option value="">请选择</option>
                    {userKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.keyFingerprint}
                      </option>
                    ))}
                  </select>
                  {userKeys.length === 0 && (
                    <p className="text-xs text-surface-400 mt-1">
                      尚无 API Key，请前往{' '}
                      <Link href="/dashboard/settings" className="text-brand-500 underline cursor-pointer">
                        设置
                      </Link>
                      {' '}添加
                    </p>
                  )}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={readmeLinksEnabled}
                onChange={(e) => setReadmeLinksEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-sm text-surface-700">自动在 README 中插入多语言入口</span>
            </label>
          </div>

          {/* File tree */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-800">
                选择文档 <span className="text-surface-400 font-normal">({selectedDocs.size} 已选)</span>
              </h2>
              <button
                onClick={loadTree}
                disabled={treeLoading}
                className="btn-ghost text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
            {treeLoading ? (
              <LoadingSpinner text="扫描文件树..." className="py-8" />
            ) : tree ? (
              <FileTree files={tree.markdownFiles} selected={selectedDocs} onToggle={toggleDoc} />
            ) : (
              <p className="text-sm text-surface-400 py-6 text-center">无法加载文件树</p>
            )}
          </div>

          {/* Save + Trigger */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存配置
            </button>
            <button
              onClick={handleTrigger}
              disabled={triggering || !canTrigger}
              className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/40"
              title={!canTrigger ? '请先完善配置并选择文档' : ''}
            >
              {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              开始翻译
            </button>

            {saveMsg && (
              <span className={`text-sm flex items-center gap-1 ${saveMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                {saveMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {saveMsg.text}
              </span>
            )}
          </div>
        </div>

        {/* Right: Job status */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-800">当前任务</h2>
          {activeJob ? (
            <div className="space-y-3">
              <JobProgress job={activeJob} />
              {(activeJob.status === 'failed' || activeJob.status === 'partial_success') && (
                <button onClick={handleRetry} className="btn-secondary text-sm w-full">
                  <RefreshCw className="w-4 h-4" />
                  重试失败项
                </button>
              )}
            </div>
          ) : (
            <div className="card p-5 text-center">
              <p className="text-sm text-surface-400">暂无正在执行的任务</p>
              <p className="text-xs text-surface-300 mt-1">配置完成后点击「开始翻译」</p>
            </div>
          )}

          <Link
            href={`/dashboard/repos/${repoId}/jobs`}
            className="btn-secondary text-sm w-full justify-center"
          >
            <History className="w-4 h-4" />
            查看历史任务
          </Link>

          <Link
            href={`/dashboard/repos/${repoId}/jobs`}
            className="btn-secondary text-sm w-full justify-center"
          >
            <GitPullRequest className="w-4 h-4" />
            查看 PR 列表
          </Link>
        </div>
      </div>
    </div>
  )
}
