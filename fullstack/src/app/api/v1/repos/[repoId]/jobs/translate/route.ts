import { getAuthUser, unauthorized, notFound, badRequest, created } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import crypto from 'crypto'

export async function POST(
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

  const config = await prisma.translationConfig.findUnique({
    where: { repoId: repo.id },
  })
  if (!config) return badRequest('Translation config not set')

  const trackedDocs = await prisma.trackedDocument.findMany({
    where: { repoId: repo.id },
  })
  if (trackedDocs.length === 0) return badRequest('No tracked documents')

  const configLangs = (config.targetLanguages as string[]) || []
  const dedupe = crypto.randomUUID()

  const job = await prisma.translationJob.create({
    data: {
      repoId: repo.id,
      triggerType: 'manual',
      status: 'pending',
      dedupeKey: dedupe,
    },
  })

  type ItemData = {
    jobId: bigint
    repoId: bigint
    sourcePath: string
    targetLanguage: string
    outputPath: string
    status: string
  }

  const items: ItemData[] = []
  for (const doc of trackedDocs) {
    const langs = (doc.targetLanguages as string[])?.length
      ? (doc.targetLanguages as string[])
      : configLangs
    for (const lang of langs) {
      items.push({
        jobId: job.id,
        repoId: repo.id,
        sourcePath: doc.sourcePath,
        targetLanguage: lang,
        outputPath: `${config.outputDir}/${lang}/${doc.sourcePath}`,
        status: 'pending',
      })
    }
  }

  await prisma.translationJobItem.createMany({ data: items })

  return created({
    jobId: job.id.toString(),
    status: job.status,
    totalItems: items.length,
  })
}
