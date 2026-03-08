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

  const docs = await prisma.trackedDocument.findMany({
    where: { repoId: repo.id },
    orderBy: { sourcePath: 'asc' },
  })

  return ok(docs.map((d) => ({
    id: d.id.toString(),
    sourcePath: d.sourcePath,
    isActive: d.isActive,
  })))
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
  const { filePaths } = body
  if (!Array.isArray(filePaths)) return badRequest('filePaths must be an array')

  await prisma.trackedDocument.deleteMany({ where: { repoId: repo.id } })

  if (filePaths.length > 0) {
    await prisma.trackedDocument.createMany({
      data: filePaths.map((fp: string) => ({
        repoId: repo.id,
        sourcePath: fp,
      })),
    })
  }

  const docs = await prisma.trackedDocument.findMany({
    where: { repoId: repo.id },
    orderBy: { sourcePath: 'asc' },
  })

  return ok(docs.map((d) => ({
    id: d.id.toString(),
    sourcePath: d.sourcePath,
    isActive: d.isActive,
  })))
}
