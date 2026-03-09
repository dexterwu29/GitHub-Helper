import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

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
    orderBy: { createdAt: 'desc' },
  })

  return ok(
    prs.map((pr) => ({
      id: pr.id.toString(),
      prNumber: pr.prNumber,
      title: `PR #${pr.prNumber}`,
      htmlUrl: pr.prUrl,
      prUrl: pr.prUrl,
      status: pr.status,
      createdAt: pr.createdAt.toISOString(),
    }))
  )
}
