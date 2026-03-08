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

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const size = Math.min(50, Math.max(1, parseInt(url.searchParams.get('size') || '20')))

  const [jobs, total] = await Promise.all([
    prisma.translationJob.findMany({
      where: { repoId: repo.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
      include: {
        _count: { select: { items: true } },
        items: {
          select: { status: true },
        },
      },
    }),
    prisma.translationJob.count({ where: { repoId: repo.id } }),
  ])

  return ok({
    list: jobs.map((j) => ({
      id: j.id.toString(),
      status: j.status,
      triggerType: j.triggerType,
      totalItems: j._count.items,
      completedItems: j.items.filter((i) => i.status === 'completed').length,
      failedItems: j.items.filter((i) => i.status === 'failed').length,
      createdAt: j.createdAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() || null,
    })),
    total,
    page,
    size,
  })
}
