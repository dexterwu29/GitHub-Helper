export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
] as const

export const JOB_STATUS_MAP: Record<string, {
  label: string
  color: string
  dotColor: string
  textColor: string
}> = {
  pending: { label: '排队中', color: 'badge-neutral', dotColor: 'bg-surface-400', textColor: 'text-surface-500' },
  running: { label: '执行中', color: 'badge-info', dotColor: 'bg-sky-500 animate-pulse', textColor: 'text-sky-600' },
  success: { label: '已完成', color: 'badge-success', dotColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
  partial_success: { label: '部分成功', color: 'badge-warning', dotColor: 'bg-amber-500', textColor: 'text-amber-600' },
  failed: { label: '失败', color: 'badge-error', dotColor: 'bg-red-500', textColor: 'text-red-600' },
  cancelled: { label: '已取消', color: 'badge-neutral', dotColor: 'bg-surface-300', textColor: 'text-surface-400' },
}

export const RUN_MODE_OPTIONS = [
  { value: 'platform', label: '平台托管额度' },
  { value: 'bring_your_key', label: '自带 API Key' },
] as const

export const POLL_INTERVAL_MS = 4000
