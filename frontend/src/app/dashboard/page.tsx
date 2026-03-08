'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  FolderGit2,
  ExternalLink,
  AlertCircle,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { repos as reposApi, githubApp, type Repo, type Installation, ApiError } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import EmptyState from '@/components/EmptyState'

export default function DashboardPage() {
  const [repoList, setRepoList] = useState<Repo[]>([])
  const [installations, setInstallations] = useState<Installation[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [r, inst] = await Promise.all([reposApi.list(), githubApp.getInstallations()])
      setRepoList(r)
      setInstallations(inst)
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleInstallApp = async () => {
    try {
      const { installUrl } = await githubApp.getInstallUrl()
      window.location.href = installUrl
    } catch {
      // handle silently
    }
  }

  const handleImport = async () => {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError('')
    try {
      await reposApi.import(importUrl.trim())
      setImportUrl('')
      setShowImport(false)
      await fetchData()
    } catch (e) {
      setImportError(e instanceof ApiError ? e.message : '导入失败，请检查仓库地址')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <LoadingSpinner text="加载仓库列表..." />

  const hasApp = installations.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">我的仓库</h1>
          <p className="text-sm text-surface-500 mt-1">管理已导入的 GitHub 仓库</p>
        </div>
        <div className="flex items-center gap-3">
          {!hasApp && (
            <button onClick={handleInstallApp} className="btn-secondary text-sm">
              <Download className="w-4 h-4" />
              安装 GitHub App
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="btn-primary text-sm"
            disabled={!hasApp}
            title={!hasApp ? '请先安装 GitHub App' : ''}
          >
            <Plus className="w-4 h-4" />
            导入仓库
          </button>
        </div>
      </div>

      {/* App install banner */}
      {!hasApp && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">尚未安装 GitHub App</p>
            <p className="text-sm text-amber-600 mt-0.5">
              请先安装{' '}
              <button onClick={handleInstallApp} className="underline font-medium cursor-pointer">
                GitHub-translator-helper-app
              </button>
              {' '}到你的账号或组织，以便访问仓库。
            </p>
          </div>
        </div>
      )}

      {/* Import dialog */}
      {showImport && (
        <div className="card p-5 border-brand-200">
          <h3 className="text-sm font-semibold text-surface-800 mb-3">导入 GitHub 仓库</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="input-field flex-1 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            <button onClick={handleImport} disabled={importing} className="btn-primary text-sm whitespace-nowrap">
              {importing ? '导入中...' : '确认导入'}
            </button>
            <button onClick={() => { setShowImport(false); setImportError('') }} className="btn-ghost text-sm">
              取消
            </button>
          </div>
          {importError && (
            <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
              <XCircle className="w-4 h-4" />
              {importError}
            </p>
          )}
        </div>
      )}

      {/* Repo list */}
      {repoList.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="暂无仓库"
          description="导入一个 GitHub 仓库开始翻译文档"
          action={
            hasApp ? (
              <button onClick={() => setShowImport(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" />
                导入第一个仓库
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4">
          {repoList.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  )
}

function RepoCard({ repo }: { repo: Repo }) {
  const configured = !!repo.config

  return (
    <Link href={`/dashboard/repos/${repo.id}`} className="block">
      <div className="card-hover p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center">
              <FolderGit2 className="w-5 h-5 text-surface-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-surface-900">{repo.fullName}</h3>
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-surface-400 hover:text-brand-500 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">
                分支: {repo.defaultBranch}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {configured ? (
              <>
                <span className="badge-success">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  已配置
                </span>
                <div className="text-right">
                  <p className="text-xs text-surface-500">
                    {repo.config!.baseLanguage} → {repo.config!.targetLanguages.join(', ')}
                  </p>
                  <p className="text-xs text-surface-400">
                    {repo.config!.runMode === 'platform' ? '平台托管' : '自带Key'}
                  </p>
                </div>
              </>
            ) : (
              <span className="badge-warning">待配置</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
