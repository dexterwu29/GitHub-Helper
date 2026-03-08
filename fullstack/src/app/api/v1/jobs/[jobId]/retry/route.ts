import { getAuthUser, unauthorized, notFound, badRequest, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { jobId } = await params
  const job = await prisma.translationJob.findUnique({
    where: { id: BigInt(jobId) },
    include: { repo: true },
  })
  if (!job || job.repo.ownerGithubId !== user.id) return notFound('Job not found')
  if (!['failed', 'partial'].includes(job.status)) {
    return badRequest('Only failed or partial jobs can be retried')
  }

  await prisma.translationJobItem.updateMany({
    where: { jobId: job.id, status: 'failed' },
    data: { status: 'pending', errorMessage: null, attempt: { increment: 1 } },
  })

  await prisma.translationJob.update({
    where: { id: job.id },
    data: { status: 'pending', finishedAt: null },
  })

  return ok({ jobId: job.id.toString(), status: 'pending' })
}
