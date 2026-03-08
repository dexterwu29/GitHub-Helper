import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { repoId } = await params
  const repo = await prisma.repository.findUnique({
    where: { id: BigInt(repoId) },
  })
  if (!repo || repo.ownerGithubId !== user.id) return notFound('Repository not found')

  const result = await prisma.translationJobItem.groupBy({
    by: ['sourcePath'],
    where: { repoId: repo.id, status: 'completed' },
  })

  return ok({ paths: result.map((r) => r.sourcePath) })
}
