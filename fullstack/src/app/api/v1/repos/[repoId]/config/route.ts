import { getAuthUser, unauthorized, notFound, badRequest, ok } from '@/lib/server/auth'
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

  const config = await prisma.translationConfig.findUnique({
    where: { repoId: repo.id },
  })

  return ok(
    config
      ? {
          id: config.id.toString(),
          baseLanguage: config.baseLanguage,
          targetLanguages: config.targetLanguages,
          runMode: config.runMode,
        }
      : null
  )
}

export async function PUT(
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

  const body = await req.json()
  const { baseLanguage, targetLanguages, runMode } = body

  if (!baseLanguage || !targetLanguages?.length) {
    return badRequest('baseLanguage and targetLanguages are required')
  }

  const config = await prisma.translationConfig.upsert({
    where: { repoId: repo.id },
    update: { baseLanguage, targetLanguages, runMode },
    create: {
      repoId: repo.id,
      baseLanguage,
      targetLanguages,
      runMode: runMode || 'platform',
    },
  })

  return ok({
    id: config.id.toString(),
    baseLanguage: config.baseLanguage,
    targetLanguages: config.targetLanguages,
    runMode: config.runMode,
  })
}
