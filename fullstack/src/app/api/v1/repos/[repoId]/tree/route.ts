import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { getInstallationOctokit, getRepoTree, getDefaultBranch } from '@/lib/server/github'
import { DEFAULT_OUTPUT_DIR } from '@/lib/constants'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { repoId } = await params
  const repo = await prisma.repository.findUnique({
    where: { id: BigInt(repoId) },
    include: { config: true },
  })
  if (!repo || repo.ownerGithubId !== user.id) return notFound('Repository not found')

  const octokit = await getInstallationOctokit(Number(repo.installationId))
  const defaultBranch = await getDefaultBranch(octokit, repo.ownerLogin, repo.repoName)

  if (repo.defaultBranch !== defaultBranch) {
    await prisma.repository.update({
      where: { id: repo.id },
      data: { defaultBranch },
    })
  }

  const allFiles = await getRepoTree(octokit, repo.ownerLogin, repo.repoName, defaultBranch)
  const outputDir = repo.config?.outputDir ?? DEFAULT_OUTPUT_DIR
  const outPrefix = `${outputDir}/`
  const files = allFiles.filter((f) => !f.startsWith(outPrefix))
  return ok({ defaultBranch, files })
}
