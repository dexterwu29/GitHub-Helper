'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, ArrowRight, FileText, GitPullRequest, Languages, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/api'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="加载中..." />
      </div>
    )
  }

  if (user) return null

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface-0/80 backdrop-blur-md border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-surface-900 font-display">GitHub Helper</span>
          </div>
          <a
            href={auth.getLoginUrl()}
            className="btn-primary text-sm"
          >
            <GithubIcon />
            GitHub 登录
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            开源仓库文档翻译神器
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 leading-tight mb-5 tracking-tight">
            不写脚本、不配 Actions
            <br />
            <span className="text-brand-500">几分钟</span>让仓库文档具备全球可读性
          </h1>

          <p className="text-lg text-surface-500 max-w-xl mx-auto mb-10 leading-relaxed">
            通过 GitHub App 授权，选择仓库中的 Markdown 文档，一键翻译为多国语言，自动提交 PR。
          </p>

          <a
            href={auth.getLoginUrl()}
            className="btn-primary text-base px-8 py-3.5 rounded-xl shadow-elevated"
          >
            <GithubIcon />
            使用 GitHub 登录开始
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-surface-0 border-y border-surface-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-surface-900 mb-12">核心能力</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<FileText className="w-5 h-5" />}
              title="智能扫描"
              desc="自动识别仓库中的 Markdown 文件，树形结构勾选"
            />
            <FeatureCard
              icon={<Languages className="w-5 h-5" />}
              title="多语言翻译"
              desc="支持10+语言，保持 Markdown 结构不变"
            />
            <FeatureCard
              icon={<GitPullRequest className="w-5 h-5" />}
              title="自动 PR"
              desc="翻译完成自动创建 PR，人工审核后合并"
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="增量重译"
              desc="文档更新后自动检测变更，仅重新翻译修改部分"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-surface-900 mb-12">三步开始</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard step={1} title="授权登录" desc="使用 GitHub 账号登录，安装 GitHub App 到你的仓库" />
            <StepCard step={2} title="配置翻译" desc="选择文档、设定基准语言和目标语言" />
            <StepCard step={3} title="一键翻译" desc="系统自动翻译并创建 PR，你只需审核合并" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-surface-400">
          <span>GitHub Helper &copy; {new Date().getFullYear()}</span>
          <span>Powered by OpenRouter</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5 group">
      <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center mb-3 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-200">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-surface-800 mb-1">{title}</h3>
      <p className="text-sm text-surface-500 leading-relaxed">{desc}</p>
    </div>
  )
}

function StepCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-brand-500 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-base font-semibold text-surface-800 mb-2">{title}</h3>
      <p className="text-sm text-surface-500">{desc}</p>
    </div>
  )
}

function GithubIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  )
}
