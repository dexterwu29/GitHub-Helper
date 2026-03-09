import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { getInstallationOctokit, getPullRequestStatus } from '@/lib/server/github'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { repoId } = await params
  const repo = await prisma.repository.findUnique({
    where: { id: BigInt(repoId) },
  })
  if (!repo || repo.ownerGithubId !== user.id) return notFound('Repository not found')

  const prs = await prisma.pullRequest.findMany({
    where: { repoId: repo.id },
    orderBy: { jobId: 'desc' },
  })

  // 从 GitHub 同步 PR 状态（用户可能在 GitHub 上已合并/关闭）
  try {
    const octokit = await getInstallationOctokit(Number(repo.installationId))
    for (const pr of prs) {
      const liveStatus = await getPullRequestStatus(
        octokit, repo.ownerLogin, repo.repoName, pr.prNumber
      )
      if (liveStatus !== pr.status) {
        await prisma.pullRequest.update({
          where: { id: pr.id },
          data: { status: liveStatus, updatedAt: new Date() },
        })
        pr.status = liveStatus
      }
    }
  } catch {
    // 同步失败时仍返回本地数据
  }

  return ok(
    prs.map((pr) => ({
      id: pr.id.toString(),
      jobId: pr.jobId.toString(),
      prNumber: pr.prNumber,
      title: `任务 #${pr.jobId} · PR #${pr.prNumber}`,
      htmlUrl: pr.prUrl,
      prUrl: pr.prUrl,
      status: pr.status,
      createdAt: pr.createdAt.toISOString(),
    }))
  )
}
