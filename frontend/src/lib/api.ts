const BASE = '/api/v1'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  const json = await res.json()

  if (!json.success) {
    const err = json.error || { code: 'UNKNOWN', message: '请求失败' }
    throw new ApiError(err.code, err.message, res.status)
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
  id: number
  githubLogin: string
  githubUserId: number
  avatarUrl: string
}

export interface Installation {
  installationId: number
  accountLogin: string
  accountType: string
}

export interface Repo {
  id: number
  fullName: string
  defaultBranch: string
  isActive: boolean
  config: RepoConfig | null
}

export interface RepoConfig {
  baseLanguage: string
  targetLanguages: string[]
  readmeLinksEnabled: boolean
  runMode: 'platform' | 'bring_your_key'
}

export interface RepoTree {
  defaultBranch: string
  markdownFiles: string[]
}

export interface ApiKey {
  id: number
  provider: string
  keyFingerprint: string
  isActive: boolean
  createdAt: string
}

export interface JobSummary {
  jobId: number
  triggerType: string
  status: string
  createdAt: string
}

export interface JobDetail {
  jobId: number
  repoId: number
  triggerType: string
  status: string
  progress: {
    total: number
    pending: number
    running: number
    success: number
    failed: number
  }
  pr: { prNumber: number; prUrl: string } | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface PullRequest {
  id: number
  prNumber: number
  title: string
  url: string
  headBranch: string
  status: string
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Auth ───
export const auth = {
  getLoginUrl: () => `${BASE}/auth/github/login`,
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// ─── GitHub App ───
export const githubApp = {
  getInstallUrl: () => request<{ installUrl: string }>('/github-app/install-url'),
  getInstallations: () => request<Installation[]>('/github-app/installations'),
}

// ─── Repos ───
export const repos = {
  import: (repoUrl: string) =>
    request<Repo>('/repos/import', {
      method: 'POST',
      body: JSON.stringify({ repoUrl }),
    }),
  list: () => request<Repo[]>('/repos'),
  getTree: (repoId: number) => request<RepoTree>(`/repos/${repoId}/tree`),
  saveConfig: (
    repoId: number,
    config: {
      baseLanguage: string
      targetLanguages: string[]
      readmeLinksEnabled: boolean
      runMode: string
      userApiKeyId: number | null
    },
  ) =>
    request<void>(`/repos/${repoId}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  saveTrackedDocs: (repoId: number, sourcePaths: string[]) =>
    request<void>(`/repos/${repoId}/tracked-docs`, {
      method: 'PUT',
      body: JSON.stringify({ sourcePaths }),
    }),
  getTrackedDocs: (repoId: number) =>
    request<string[]>(`/repos/${repoId}/tracked-docs`),
}

// ─── Keys ───
export const keys = {
  add: (apiKey: string) =>
    request<ApiKey>('/keys/openrouter', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    }),
  list: () => request<ApiKey[]>('/keys/openrouter'),
  remove: (keyId: number) =>
    request<void>(`/keys/openrouter/${keyId}`, { method: 'DELETE' }),
}

// ─── Jobs ───
export const jobs = {
  trigger: (repoId: number) =>
    request<{ jobId: number; status: string }>(`/repos/${repoId}/jobs/translate`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'full' }),
    }),
  get: (jobId: number) => request<JobDetail>(`/jobs/${jobId}`),
  list: (repoId: number, page = 1, pageSize = 10) =>
    request<Paginated<JobSummary>>(`/repos/${repoId}/jobs?page=${page}&pageSize=${pageSize}`),
  retry: (jobId: number) =>
    request<void>(`/jobs/${jobId}/retry`, { method: 'POST' }),
  cancel: (jobId: number) =>
    request<void>(`/jobs/${jobId}/cancel`, { method: 'POST' }),
}

// ─── Pull Requests ───
export const pullRequests = {
  list: (repoId: number, page = 1, pageSize = 10, status?: string) => {
    let url = `/repos/${repoId}/pull-requests?page=${page}&pageSize=${pageSize}`
    if (status) url += `&status=${status}`
    return request<Paginated<PullRequest>>(url)
  },
}
