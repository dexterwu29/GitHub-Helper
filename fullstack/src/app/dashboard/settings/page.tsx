'use client'

import { useEffect, useState } from 'react'
import {
  Key,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { keys as keysApi, type ApiKey, ApiError } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'
import EmptyState from '@/components/EmptyState'

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadKeys = async () => {
    try {
      const list = await keysApi.list()
      setApiKeys(list)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadKeys().finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!newKey.trim()) return
    setAdding(true)
    setMsg(null)
    try {
      await keysApi.add(newKey.trim())
      setNewKey('')
      setShowForm(false)
      setMsg({ type: 'ok', text: 'API Key 添加成功' })
      await loadKeys()
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof ApiError ? e.message : '添加失败' })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await keysApi.remove(id)
      setMsg({ type: 'ok', text: 'API Key 已删除' })
      await loadKeys()
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof ApiError ? e.message : '删除失败' })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <LoadingSpinner text="加载设置..." />

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-surface-900">设置</h1>
        <p className="text-sm text-surface-500 mt-1">管理你的 OpenRouter API Key</p>
      </div>

      {/* Info card */}
      <div className="card p-4 bg-brand-50/50 border-brand-200">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-brand-800">关于 API Key</p>
            <p className="text-sm text-brand-700 mt-1 leading-relaxed">
              当仓库翻译配置选择「自带 Key」模式时，将使用你在此处添加的 OpenRouter API Key 进行翻译调用。
              Key 以加密形式存储，不会泄露。
            </p>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 mt-2 font-medium cursor-pointer"
            >
              前往 OpenRouter 获取 Key
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Feedback message */}
      {msg && (
        <div className={`flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Key list */}
      <div className="card divide-y divide-surface-100">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-800">我的 API Keys</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary text-sm px-3 py-1.5"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>

        {showForm && (
          <div className="p-4 bg-surface-50">
            <label className="block text-sm font-medium text-surface-700 mb-1.5">OpenRouter API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="input-field flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button onClick={handleAdd} disabled={adding || !newKey.trim()} className="btn-primary text-sm">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认'}
              </button>
              <button onClick={() => { setShowForm(false); setNewKey('') }} className="btn-ghost text-sm">
                取消
              </button>
            </div>
          </div>
        )}

        {apiKeys.length === 0 && !showForm ? (
          <div className="p-6">
            <EmptyState
              icon={Key}
              title="暂无 API Key"
              description="使用「自带 Key」模式时需要添加 OpenRouter API Key"
              action={{ label: '添加 Key', onClick: () => setShowForm(true) }}
            />
          </div>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center">
                  <Key className="w-4 h-4 text-surface-500" />
                </div>
                <div>
                  <p className="text-sm font-mono text-surface-800">{key.label || key.fingerprint}</p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    添加于 {new Date(key.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(key.id)}
                disabled={deletingId === key.id}
                className="btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
              >
                {deletingId === key.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
