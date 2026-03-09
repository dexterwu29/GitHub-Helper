import { NextResponse } from 'next/server'
import { getAuthUser, unauthorized, notFound, ok } from '@/lib/server/auth'
import { prisma } from '@/lib/server/prisma'
import { getInstallationOctokit, getFileContent, createOrUpdateFile, getFileSha, createPullRequest } from '@/lib/server/github'
import { buildReadmeTranslationsSection, upsertReadmeTranslationsSection } from '@/lib/server/readme-translations'
import { GITHUB_APP_DISPLAY_NAME, GITHUB_APP_URL } from '@/lib/constants'

/** 为已完成/部分成功的任务手动创建 PR（当自动创建失败时使用） */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) return unauthorized()

    const { jobId } = await params
    let jobIdNum: bigint
    try {
      jobIdNum = BigInt(jobId)
    } catch {
      return notFound('Job not found')
    }

    const job = await prisma.translationJob.findUnique({
      where: { id: jobIdNum },
      include: { items: true, repo: true, prs: true },
    })
    if (!job || job.repo.ownerGithubId !== user.id) return notFound('Job not found')

    if (job.status !== 'completed' && job.status !== 'partial') {
      return NextResponse.json(
        { code: 1, message: '仅支持已完成或部分成功的任务' },
        { status: 400 }
      )
    }

    const completedCount = job.items.filter((i) => i.status === 'completed').length
    if (completedCount === 0) {
      return NextResponse.json(
        { code: 1, message: '无成功翻译项，无法创建 PR' },
        { status: 400 }
      )
    }

    if (job.prs.length > 0) {
      return NextResponse.json(
        { code: 1, message: '该任务已有 PR', prUrl: job.prs[0].prUrl },
        { status: 400 }
      )
    }

    const octokit = await getInstallationOctokit(Number(job.repo.installationId))
    const branchName = `translate/job-${job.id}`
    const totalCount = job.items.length
    const config = await prisma.translationConfig.findUnique({
      where: { repoId: job.repo.id },
    })
    if (config?.readmeLinksEnabled) {
      const completedItems = job.items
        .filter((i) => i.status === 'completed')
        .map((i) => ({ sourcePath: i.sourcePath, targetLanguage: i.targetLanguage, outputPath: i.outputPath }))
      if (completedItems.length > 0) {
        try {
              let readmeContent = ''
              try {
                readmeContent = await getFileContent(
                  octokit, job.repo.ownerLogin, job.repo.repoName, 'README.md', job.repo.defaultBranch
                )
              } catch {
                readmeContent = '# ' + job.repo.repoName + '\n\n'
              }
              const section = buildReadmeTranslationsSection(readmeContent, completedItems)
              const updatedReadme = upsertReadmeTranslationsSection(readmeContent, section)
          const readmeSha = await getFileSha(
            octokit, job.repo.ownerLogin, job.repo.repoName, 'README.md', branchName
          )
          await createOrUpdateFile(
            octokit, job.repo.ownerLogin, job.repo.repoName, 'README.md', updatedReadme,
            'docs: add README translations section with doc links',
            branchName, readmeSha
          )
        } catch (readmeErr) {
          console.error('[create-pr] README update failed', readmeErr)
        }
      }
    }

    const prTitle = `[${GITHUB_APP_DISPLAY_NAME}] Translation Job #${job.id}`
    const prBody = `🤖 **Created by [${GITHUB_APP_DISPLAY_NAME}](${GITHUB_APP_URL})** - Markdown translation assistant for GitHub repositories.

- Job ID: ${job.id}
- Completed: ${completedCount}/${totalCount}`
    const pr = await createPullRequest(
      octokit,
      job.repo.ownerLogin,
      job.repo.repoName,
      prTitle,
      branchName,
      job.repo.defaultBranch,
      prBody
    )

    await prisma.pullRequest.create({
      data: {
        repoId: job.repo.id,
        jobId: job.id,
        prNumber: pr.number,
        prUrl: pr.html_url,
        headBranch: branchName,
        baseBranch: job.repo.defaultBranch,
        status: pr.state,
      },
    })

    return ok({ prUrl: pr.html_url, prNumber: pr.number })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[create-pr]', err)
    return NextResponse.json(
      { code: 1, message: msg || '创建 PR 失败' },
      { status: 500 }
    )
  }
}
