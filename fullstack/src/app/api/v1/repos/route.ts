import { NextResponse } from 'next/server'
import { getAuthUser, unauthorized, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return unauthorized()

    const repos = await prisma.repository.findMany({
      where: { ownerGithubId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return ok(
      repos.map((r) => ({
        id: r.id.toString(),
        fullName: r.fullName,
        owner: r.ownerLogin,
        name: r.repoName,
        defaultBranch: r.defaultBranch,
        installationId: r.installationId.toString(),
        createdAt: r.createdAt.toISOString(),
      }))
    )
  } catch (err) {
    console.error('[GET /api/v1/repos]', err)
    return NextResponse.json(
      { code: 1, message: err instanceof Error ? err.message : 'Internal error', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
