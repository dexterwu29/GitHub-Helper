import { NextResponse } from 'next/server'
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
  try {
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

    const uniquePaths = [...new Set(filePaths)].filter((fp): fp is string => typeof fp === 'string' && fp.length > 0)

    await prisma.trackedDocument.deleteMany({ where: { repoId: repo.id } })

    if (uniquePaths.length > 0) {
      await prisma.trackedDocument.createMany({
        data: uniquePaths.map((fp) => ({
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
  } catch (err) {
    console.error('[tracked-docs PUT]', err)
    return NextResponse.json(
      { code: 1, message: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
