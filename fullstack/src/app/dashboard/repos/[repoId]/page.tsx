'use client'

import { useEffect, useState, useCallback, useRef, use } from 'react'
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
  type RepoConfig,
  type ApiKey,
  type JobDetail,
  ApiError,
} from '@/lib/api'
import { SUPPORTED_LANGUAGES, RUN_MODE_OPTIONS, POLL_INTERVAL_MS } from '@/lib/constants'
import FileTree from '@/components/FileTree'
import JobProgress from '@/components/JobProgress'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function RepoDetailPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params)

  const [repo, setRepo] = useState<Repo | null>(null)
  const [tree, setTree] = useState<RepoTree | null>(null)
  const [userKeys, setUserKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [baseLanguage, setBaseLanguage] = useState('')
  const [targetLanguages, setTargetLanguages] = useState<string[]>([])
  const [runMode, setRunMode] = useState('platform')
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [translatedPaths, setTranslatedPaths] = useState<Set<string>>(new Set())

  const [activeJob, setActiveJob] = useState<JobDetail | null>(null)
  const [triggering, setTriggering] = useState(false)

  const loadRepo = useCallback(async () => {
    try {
      const list = await reposApi.list()
      const found = list.find((r) => r.id === repoId)
      if (found) {
        setRepo(found)
        const config = await reposApi.getConfig(repoId)
        if (config) {
          setBaseLanguage(config.baseLanguage)
          setTargetLanguages(config.targetLanguages)
          setRunMode(config.runMode)
        }
      }
    } catch {
      // ignore
    }
  }, [repoId])

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    try {
      const [t, tracked, translated] = await Promise.all([
        reposApi.getTree(repoId),
        reposApi.getTrackedDocs(repoId),
        reposApi.getTranslatedDocs(repoId).catch(() => []),
      ])
      setTree(t)
      setSelectedDocs(new Set(tracked.map((d) => d.sourcePath)))
      setTranslatedPaths(new Set(translated))
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

  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current || !repoId || !tree) return
    const timer = setTimeout(() => {
      reposApi.saveTrackedDocs(repoId, Array.from(selectedDocs)).catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [repoId, selectedDocs, tree])

  useEffect(() => {
    if (!loading && tree) initialLoadDone.current = true
  }, [loading, tree])

  useEffect(() => {
    if (!activeJob) return
    const terminal = ['completed', 'failed', 'partial', 'cancelled']
    if (terminal.includes(activeJob.status)) return

    const timer = setInterval(async () => {
      try {
        const updated = await jobsApi.get(activeJob.id)
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
        runMode,
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
    setSaveMsg(null)
    try {
      // 自动保存配置和文档选择，避免用户忘记点「保存配置」
      await reposApi.saveConfig(repoId, {
        baseLanguage,
        targetLanguages,
        runMode,
      })
      await reposApi.saveTrackedDocs(repoId, Array.from(selectedDocs))

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
      await jobsApi.retry(activeJob.id)
      const updated = await jobsApi.get(activeJob.id)
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

  const selectPaths = (paths: string[], add: boolean) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev)
      paths.forEach((p) => (add ? next.add(p) : next.delete(p)))
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
        <Link href={`/dashboard/repos/${repoId}/jobs`} className="btn-secondary text-sm">
          <History className="w-4 h-4" />
          任务历史
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">调用模式</label>
              <select
                value={runMode}
                onChange={(e) => setRunMode(e.target.value)}
                className="input-field"
              >
                {RUN_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {runMode === 'byoKey' && (
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">你的 API Key</label>
                {userKeys.length > 0 ? (
                  <p className="text-sm text-emerald-600">已配置 {userKeys.length} 个 Key</p>
                ) : (
                  <p className="text-xs text-surface-400">
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

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-800">
                选择文档 <span className="text-surface-400 font-normal">({selectedDocs.size} 已选)</span>
              </h2>
              <button onClick={loadTree} disabled={treeLoading} className="btn-ghost text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${treeLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
            {treeLoading ? (
              <LoadingSpinner text="扫描文件树..." className="py-8" />
            ) : tree ? (
              <FileTree
                  files={tree.files}
                  selected={selectedDocs}
                  onToggle={toggleDoc}
                  onSelectPaths={selectPaths}
                  translatedPaths={translatedPaths}
                />
            ) : (
              <p className="text-sm text-surface-400 py-6 text-center">无法加载文件树</p>
            )}
          </div>

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

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-800">当前任务</h2>
          {activeJob ? (
            <div className="space-y-3">
              <JobProgress job={activeJob} />
              {(activeJob.status === 'failed' || activeJob.status === 'partial') && (
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
