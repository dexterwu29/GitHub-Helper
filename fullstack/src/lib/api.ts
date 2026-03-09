const BASE = '/api/v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  let json: { code?: number; message?: string; errorCode?: string; data?: T }
  try {
    json = await res.json()
  } catch {
    throw new ApiError('PARSE_ERROR', res.status >= 500 ? '服务异常' : '响应解析失败', res.status)
  }

  if (json.code !== 0) {
    throw new ApiError(json.errorCode || 'UNKNOWN', json.message || '请求失败', res.status)
  }

  return json.data as T
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface User {
  id: string
  githubId: number
  login: string
  avatarUrl: string
}

export interface Installation {
  installationId: number
  account: string | null
  targetType: string
  repositorySelection: string
}

export interface Repo {
  id: string
  fullName: string
  owner: string
  name: string
  defaultBranch: string
  installationId: number
  createdAt: string
}

export interface RepoConfig {
  id: string
  baseLanguage: string
  targetLanguages: string[]
  modelName: string | null
  runMode: string
}

export interface RepoTree {
  defaultBranch: string
  files: string[]
}

export interface TrackedDoc {
  id: string
  sourcePath: string
  targetLanguages: string[]
  isActive: boolean
}

export interface ApiKey {
  id: string
  label: string
  fingerprint: string
  createdAt: string
}

export interface JobSummary {
  id: string
  status: string
  triggerType: string
  totalItems: number
  completedItems: number
  failedItems: number
  createdAt: string
  finishedAt: string | null
}

export interface JobDetail extends JobSummary {
  repoId: string
  items: JobItem[]
  prs?: { prUrl: string; prNumber: number }[]
}

export interface JobItem {
  id: string
  sourcePath: string
  outputPath: string
  targetLanguage: string
  status: string
  errorMessage: string | null
}

export interface PullRequestInfo {
  id: string
  jobId: string
  prNumber: number
  title: string
  htmlUrl: string
  status: string
  createdAt: string
}

export interface Paginated<T> {
  list: T[]
  total: number
  page: number
  size: number
}

// ─── Auth ───
export const auth = {
  getLoginUrl: () => `${BASE}/auth/github/login`,
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// ─── GitHub App ───
export const githubApp = {
  getInstallUrl: async () => {
    const data = await request<{ url: string }>('/github-app/install-url')
    return data.url
  },
  getInstallations: () => request<Installation[]>('/github-app/installations'),
}

// ─── Repos ───
export const repos = {
  import: (repoUrl: string) =>
    request<{ id: string; fullName: string; defaultBranch: string }>('/repos/import', {
      method: 'POST',
      body: JSON.stringify({ repoUrl }),
    }),
  list: () => request<Repo[]>('/repos'),
  getTree: (repoId: string) => request<RepoTree>(`/repos/${repoId}/tree`),
  getConfig: (repoId: string) => request<RepoConfig | null>(`/repos/${repoId}/config`),
  saveConfig: (
    repoId: string,
    config: {
      baseLanguage: string
      targetLanguages: string[]
      modelName?: string
      runMode?: string
    },
  ) =>
    request<RepoConfig>(`/repos/${repoId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  getTrackedDocs: (repoId: string) => request<TrackedDoc[]>(`/repos/${repoId}/tracked-docs`),
  getTranslatedDocs: (repoId: string) =>
    request<{ paths: string[] }>(`/repos/${repoId}/translated-docs`).then((d) => d.paths),
  saveTrackedDocs: (
    repoId: string,
    filePaths: string[],
    removedPaths?: string[],
    docLanguages?: Record<string, string[]>
  ) =>
    request<TrackedDoc[]>(`/repos/${repoId}/tracked-docs`, {
      method: 'PUT',
      body: JSON.stringify({ filePaths, removedPaths: removedPaths ?? [], docLanguages: docLanguages ?? {} }),
    }),
  refreshReadme: (repoId: string) =>
    request<{ prUrl: string; prNumber: number }>(`/repos/${repoId}/refresh-readme`, {
      method: 'POST',
    }),
}

// ─── Keys ───
export const keys = {
  add: (apiKey: string, label?: string) =>
    request<{ id: string; label: string; fingerprint: string }>('/keys/openrouter', {
      method: 'POST',
      body: JSON.stringify({ apiKey, label }),
    }),
  list: () => request<ApiKey[]>('/keys/openrouter'),
  remove: (keyId: string) =>
    request<null>(`/keys/openrouter/${keyId}`, { method: 'DELETE' }),
}

// ─── Jobs ───
export const jobs = {
  trigger: (repoId: string) =>
    request<{ jobId: string; status: string; totalItems: number }>(
      `/repos/${repoId}/jobs/translate`,
      { method: 'POST' },
    ),
  get: (jobId: string) => request<JobDetail>(`/jobs/${jobId}`),
  list: (repoId: string, page = 1, size = 20) =>
    request<Paginated<JobSummary>>(`/repos/${repoId}/jobs?page=${page}&size=${size}`),
  retry: (jobId: string) =>
    request<{ jobId: string; status: string }>(`/jobs/${jobId}/retry`, { method: 'POST' }),
  cancel: (jobId: string) =>
    request<{ jobId: string; status: string }>(`/jobs/${jobId}/cancel`, { method: 'POST' }),
  processNow: () =>
    request<{ ok: boolean; processed: number }>(`/jobs/process-now`, { method: 'POST' }),
  createPr: (jobId: string) =>
    request<{ prUrl: string; prNumber: number }>(`/jobs/${jobId}/create-pr`, { method: 'POST' }),
}

// ─── Pull Requests ───
export const pullRequests = {
  list: (repoId: string) => request<PullRequestInfo[]>(`/repos/${repoId}/pull-requests`),
}
