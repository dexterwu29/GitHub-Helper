import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { jobId } = await params
  const job = await prisma.translationJob.findUnique({
    where: { id: BigInt(jobId) },
    include: { items: true, repo: true },
  })
  if (!job || job.repo.ownerGithubId !== user.id) return notFound('Job not found')

  const totalItems = job.items.length
  const completedItems = job.items.filter((i) => i.status === 'completed').length
  const failedItems = job.items.filter((i) => i.status === 'failed').length

  return ok({
    id: job.id.toString(),
    repoId: job.repoId.toString(),
    status: job.status,
    triggerType: job.triggerType,
    totalItems,
    completedItems,
    failedItems,
    startedAt: job.startedAt?.toISOString() || null,
    finishedAt: job.finishedAt?.toISOString() || null,
    items: job.items.map((it) => ({
      id: it.id.toString(),
      sourcePath: it.sourcePath,
      outputPath: it.outputPath,
      targetLanguage: it.targetLanguage,
      status: it.status,
      errorMessage: it.errorMessage,
    })),
  })
}
