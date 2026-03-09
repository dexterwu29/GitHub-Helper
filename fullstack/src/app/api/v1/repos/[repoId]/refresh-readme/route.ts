import { NextResponse } from 'next/server'
import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import {
  getInstallationOctokit,
  getRepoTree,
  getDefaultBranch,
  getFileContent,
  getFileSha,
  createBranch,
  createOrUpdateFile,
  createPullRequest,
} from '@/lib/server/github'
import {
  buildReadmeTranslationsSectionFromI18nPaths,
  upsertReadmeTranslationsSection,
} from '@/lib/server/readme-translations'
import { DEFAULT_OUTPUT_DIR, GITHUB_APP_DISPLAY_NAME, GITHUB_APP_URL } from '@/lib/constants'

/** 一键刷新 README.md 的 Translations 区块，基于 _i18n 全量内容，并提交 PR */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return unauthorized()

    const { repoId } = await params
    const repo = await prisma.repository.findUnique({
      where: { id: BigInt(repoId) },
      include: { config: true },
    })
    if (!repo || repo.ownerGithubId !== user.id) return notFound('仓库未找到')

    const octokit = await getInstallationOctokit(Number(repo.installationId))
    let defaultBranch = await getDefaultBranch(octokit, repo.ownerLogin, repo.repoName)
    if (repo.defaultBranch !== defaultBranch) {
      await prisma.repository.update({
        where: { id: repo.id },
        data: { defaultBranch },
      })
    }
    const outputDir = repo.config?.outputDir ?? DEFAULT_OUTPUT_DIR
    const prefix = outputDir.endsWith('/') ? outputDir : `${outputDir}/`

    const allPaths = await getRepoTree(octokit, repo.ownerLogin, repo.repoName, defaultBranch)
    const i18nPaths = allPaths.filter((p) => p.startsWith(prefix) && p.endsWith('.md'))

    if (i18nPaths.length === 0) {
      return NextResponse.json(
        { code: 1, message: `未找到 ${outputDir} 下的翻译文件，无法刷新` },
        { status: 400 }
      )
    }

    const section = buildReadmeTranslationsSectionFromI18nPaths(i18nPaths, outputDir)
    if (!section.trim()) {
      return NextResponse.json(
        { code: 1, message: '无法生成 Translations 区块' },
        { status: 400 }
      )
    }

    let readmeContent: string
    try {
      readmeContent = await getFileContent(
        octokit,
        repo.ownerLogin,
        repo.repoName,
        'README.md',
        defaultBranch
      )
    } catch {
      return NextResponse.json(
        { code: 1, message: '仓库未找到 README.md，无法刷新' },
        { status: 400 }
      )
    }

    const updatedReadme = upsertReadmeTranslationsSection(readmeContent, section)
    if (updatedReadme === readmeContent) {
      return NextResponse.json(
        { code: 1, message: 'README 无变化，无需提交' },
        { status: 400 }
      )
    }

    const branchName = `refresh-readme-${Date.now()}`
    await createBranch(octokit, repo.ownerLogin, repo.repoName, branchName, defaultBranch)

    const readmeSha = await getFileSha(
      octokit,
      repo.ownerLogin,
      repo.repoName,
      'README.md',
      branchName
    )
    await createOrUpdateFile(
      octokit,
      repo.ownerLogin,
      repo.repoName,
      'README.md',
      updatedReadme,
      'docs: refresh README Translations section from _i18n',
      branchName,
      readmeSha
    )

    const prTitle = `[${GITHUB_APP_DISPLAY_NAME}] Refresh README Translations`
    const prBody = `🤖 **Created by [${GITHUB_APP_DISPLAY_NAME}](${GITHUB_APP_URL})**

根据 \`${outputDir}\` 目录下的全量翻译文件，规范化 README.md 的 Translations 区块。`
    const pr = await createPullRequest(
      octokit,
      repo.ownerLogin,
      repo.repoName,
      prTitle,
      branchName,
      defaultBranch,
      prBody
    )

    return ok({ prUrl: pr.html_url, prNumber: pr.number })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[refresh-readme]', err)
    return NextResponse.json(
      { code: 1, message: msg || '刷新 README 失败' },
      { status: 500 }
    )
  }
}
