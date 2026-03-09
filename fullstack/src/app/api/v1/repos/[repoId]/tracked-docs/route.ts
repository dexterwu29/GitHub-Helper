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
    targetLanguages: (d.targetLanguages as string[]) || [],
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
    const { filePaths, removedPaths, docLanguages } = body
    if (!Array.isArray(filePaths)) return badRequest('filePaths must be an array')

    const uniquePaths = [...new Set(filePaths)].filter((fp): fp is string => typeof fp === 'string' && fp.length > 0)
    const toRemove = Array.isArray(removedPaths)
      ? [...new Set(removedPaths)].filter((fp): fp is string => typeof fp === 'string' && fp.length > 0)
      : []
    const langMap = (typeof docLanguages === 'object' && docLanguages !== null ? docLanguages : {}) as Record<string, string[]>

    const config = await prisma.translationConfig.findUnique({
      where: { repoId: repo.id },
    })
    const defaultLangs = (config?.targetLanguages as string[]) || []

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.trackedDocument.deleteMany({
          where: { repoId: repo.id, sourcePath: { in: toRemove } },
        })
      }
      for (const fp of uniquePaths) {
        const langs = Array.isArray(langMap[fp]) && langMap[fp].length > 0
          ? langMap[fp]
          : defaultLangs
        await tx.trackedDocument.upsert({
          where: { repoId_sourcePath: { repoId: repo.id, sourcePath: fp } },
          create: { repoId: repo.id, sourcePath: fp, targetLanguages: langs },
          update: { isActive: true, targetLanguages: langs },
        })
      }
    })

    const docs = await prisma.trackedDocument.findMany({
      where: { repoId: repo.id },
      orderBy: { sourcePath: 'asc' },
    })

    return ok(docs.map((d) => ({
      id: d.id.toString(),
      sourcePath: d.sourcePath,
      targetLanguages: (d.targetLanguages as string[]) || [],
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
