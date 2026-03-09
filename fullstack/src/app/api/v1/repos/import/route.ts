import { getAuthUser, unauthorized, badRequest, created } from '@/lib/server/auth'
import { getInstallationForRepo, getInstallationOctokit } from '@/lib/server/github'
import { prisma } from '@/lib/server/prisma'

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const body = await req.json()
  const { repoUrl } = body
  if (!repoUrl) return badRequest('repoUrl is required')

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return badRequest('Invalid GitHub URL')

  const owner = match[1]
  const name = match[2].replace(/\.git$/, '')

  // Check ownership first: User B cannot import User A's repo. Reject before checking installation.
  if (owner.toLowerCase() !== user.githubLogin.toLowerCase()) {
    return badRequest('您只能导入自己拥有的仓库，请先在您的仓库上安装 GitHub App 后再导入。')
  }

  const installation = await getInstallationForRepo(owner, name)
  if (!installation) {
    return badRequest('GitHub App not installed on this repository. Please install the app first.')
  }

  const existing = await prisma.repository.findFirst({
    where: { fullName: `${owner}/${name}` },
  })
  if (existing && existing.ownerGithubId === user.id) {
    return created({
      id: existing.id.toString(),
      fullName: existing.fullName,
      defaultBranch: existing.defaultBranch,
    })
  }

  const octokit = await getInstallationOctokit(installation.id)
  const { data: ghRepo } = await octokit.repos.get({ owner, repo: name })

  const repo = await prisma.repository.create({
    data: {
      ownerGithubId: user.id,
      githubRepoId: ghRepo.id,
      fullName: `${owner}/${name}`,
      ownerLogin: owner,
      repoName: name,
      defaultBranch: ghRepo.default_branch || 'main',
      installationId: installation.id,
    },
  })

  return created({
    id: repo.id.toString(),
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
  })
}
