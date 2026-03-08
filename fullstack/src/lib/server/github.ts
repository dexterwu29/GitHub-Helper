import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export function getOctokit(token: string) {
  return new Octokit({ auth: token })
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_APP_CLIENT_ID!,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET!,
      code,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

export async function getGitHubUser(accessToken: string) {
  const octokit = getOctokit(accessToken)
  const { data } = await octokit.users.getAuthenticated()
  return data
}

function resolvePrivateKey(): string {
  // Priority 1: read from .pem file (most reliable on Windows)
  const pemPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH
    || path.resolve(process.cwd(), 'private-key.pem')
  try {
    if (fs.existsSync(pemPath)) {
      const pem = fs.readFileSync(pemPath, 'utf-8').trim()
      if (pem.includes('-----BEGIN')) return normalizePem(pem)
    }
  } catch { /* fall through */ }

  // Priority 2: env var
  const raw = process.env.GITHUB_APP_PRIVATE_KEY
  if (!raw) throw new Error('GitHub App private key not found. Place private-key.pem in project root or set GITHUB_APP_PRIVATE_KEY env var.')

  // Could be base64 encoded
  if (!raw.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8')
      if (decoded.includes('-----BEGIN')) return normalizePem(decoded)
    } catch { /* fall through */ }
  }

  return normalizePem(raw)
}

function normalizePem(pem: string): string {
  let key = pem.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()

  // Convert PKCS#1 to PKCS#8 for Node.js 20+ / OpenSSL 3.x compatibility
  if (key.includes('BEGIN RSA PRIVATE KEY')) {
    try {
      const keyObj = crypto.createPrivateKey({ key, format: 'pem' })
      key = keyObj.export({ type: 'pkcs8', format: 'pem' }) as string
    } catch {
      // If conversion fails, return as-is and let downstream handle it
    }
  }

  return key
}

let _cachedKey: string | null = null
function getPrivateKey(): string {
  if (!_cachedKey) _cachedKey = resolvePrivateKey()
  return _cachedKey
}

export function getAppOctokit() {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: getPrivateKey(),
    },
  })
}

export async function getInstallationOctokit(installationId: number) {
  const appOctokit = getAppOctokit()
  const { data } = await appOctokit.apps.createInstallationAccessToken({
    installation_id: installationId,
  })
  return new Octokit({ auth: data.token })
}

export async function getUserInstallations(accessToken: string) {
  const octokit = getOctokit(accessToken)
  const { data } = await octokit.apps.listInstallationsForAuthenticatedUser()
  const appId = Number(process.env.GITHUB_APP_ID!)
  return data.installations.filter((i) => i.app_id === appId)
}

export async function listAppInstallations() {
  const appOctokit = getAppOctokit()
  const { data } = await appOctokit.apps.listInstallations()
  return data
}

export async function getInstallationForRepo(owner: string, repo: string) {
  const appOctokit = getAppOctokit()
  try {
    const { data } = await appOctokit.apps.getRepoInstallation({ owner, repo })
    return data
  } catch {
    return null
  }
}

export async function getRepoTree(octokit: Octokit, owner: string, repo: string, branch: string) {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true',
  })
  return data.tree
    .filter((item) => item.type === 'blob' && item.path?.endsWith('.md'))
    .map((item) => item.path!)
}

export async function getFileContent(octokit: Octokit, owner: string, repo: string, path: string, ref?: string) {
  const params: { owner: string; repo: string; path: string; ref?: string } = { owner, repo, path }
  if (ref) params.ref = ref
  const { data } = await octokit.repos.getContent(params)
  if ('content' in data) {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  throw new Error('Not a file')
}

export async function createOrUpdateFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string
) {
  const params: {
    owner: string; repo: string; path: string;
    message: string; content: string; branch: string; sha?: string
  } = {
    owner, repo, path, message,
    content: Buffer.from(content).toString('base64'),
    branch,
  }
  if (sha) params.sha = sha
  return octokit.repos.createOrUpdateFileContents(params)
}

export async function getFileSha(octokit: Octokit, owner: string, repo: string, path: string, branch: string) {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch })
    if ('sha' in data) return data.sha as string
    return undefined
  } catch {
    return undefined
  }
}

export async function createBranch(octokit: Octokit, owner: string, repo: string, branchName: string, fromBranch: string) {
  const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${fromBranch}` })
  try {
    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
    })
  } catch (err: unknown) {
    const e = err as { status?: number }
    if (e.status !== 422) throw err
  }
}

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string
) {
  const { data } = await octokit.pulls.create({ owner, repo, title, head, base, body })
  return data
}

export async function getDefaultBranch(octokit: Octokit, owner: string, repo: string) {
  const { data } = await octokit.repos.get({ owner, repo })
  return data.default_branch
}
