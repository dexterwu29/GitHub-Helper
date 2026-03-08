import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { getInstallationOctokit, getFileContent, createOrUpdateFile, getFileSha, createBranch, createPullRequest } from '@/lib/server/github'
import { translateMarkdown } from '@/lib/server/translation'
import { decrypt } from '@/lib/server/crypto'

export async function GET(req: NextRequest) {
  try {
    const isLocal = process.env.APP_ENV === 'local'
    if (!isLocal) {
      const authHeader = req.headers.get('authorization')
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const pendingJobs = await prisma.translationJob.findMany({
      where: { status: { in: ['pending', 'running'] } },
      take: 5,
      orderBy: { id: 'asc' },
    })

    for (const job of pendingJobs) {
      if (job.status === 'pending') {
        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: 'running', startedAt: new Date() },
        })
      }

      const repo = await prisma.repository.findUnique({
        where: { id: job.repoId },
      })
      if (!repo) continue

      const config = await prisma.translationConfig.findUnique({
        where: { repoId: repo.id },
      })
      if (!config) continue

      let apiKey = process.env.OPENROUTER_API_KEY_PLATFORM!
      if (config.runMode === 'byoKey' && config.userApiKeyId) {
        const userKey = await prisma.userApiKey.findUnique({
          where: { id: config.userApiKeyId },
        })
        if (userKey) apiKey = decrypt(userKey.encryptedKey)
      }

      const octokit = await getInstallationOctokit(Number(repo.installationId))
      const branchName = `translate/job-${job.id}`
      await createBranch(octokit, repo.ownerLogin, repo.repoName, branchName, repo.defaultBranch)

      const pendingItems = await prisma.translationJobItem.findMany({
        where: { jobId: job.id, status: 'pending' },
        take: 10,
      })

      for (const item of pendingItems) {
        await prisma.translationJobItem.update({
          where: { id: item.id },
          data: { status: 'running' },
        })

        try {
          const sourceContent = await getFileContent(
            octokit, repo.ownerLogin, repo.repoName, item.sourcePath, repo.defaultBranch
          )

          const translated = await translateMarkdown(
            sourceContent, item.targetLanguage, apiKey
          )

          const existingSha = await getFileSha(
            octokit, repo.ownerLogin, repo.repoName, item.outputPath, branchName
          )

          await createOrUpdateFile(
            octokit, repo.ownerLogin, repo.repoName, item.outputPath, translated,
            `docs: translate ${item.sourcePath} to ${item.targetLanguage}`,
            branchName, existingSha
          )

          await prisma.translationJobItem.update({
            where: { id: item.id },
            data: { status: 'completed' },
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          await prisma.translationJobItem.update({
            where: { id: item.id },
            data: { status: 'failed', errorMessage: msg.slice(0, 2000) },
          })
        }
      }

      const remaining = await prisma.translationJobItem.count({
        where: { jobId: job.id, status: 'pending' },
      })

      if (remaining === 0) {
        const completedCount = await prisma.translationJobItem.count({
          where: { jobId: job.id, status: 'completed' },
        })
        const failedCount = await prisma.translationJobItem.count({
          where: { jobId: job.id, status: 'failed' },
        })
        const totalCount = await prisma.translationJobItem.count({
          where: { jobId: job.id },
        })

        let finalStatus: string
        if (failedCount === 0) {
          finalStatus = 'completed'
        } else if (completedCount > 0) {
          finalStatus = 'partial'
        } else {
          finalStatus = 'failed'
        }

        await prisma.translationJob.update({
          where: { id: job.id },
          data: { status: finalStatus, finishedAt: new Date() },
        })

        if (completedCount > 0) {
          try {
            const prTitle = `[Translation] Job #${job.id} translations`
            const pr = await createPullRequest(
              octokit, repo.ownerLogin, repo.repoName,
              prTitle,
              branchName,
              repo.defaultBranch,
              `Automated translation by GitHub Helper\n\nJob ID: ${job.id}\nCompleted: ${completedCount}/${totalCount}`
            )

            await prisma.pullRequest.create({
              data: {
                repoId: repo.id,
                jobId: job.id,
                prNumber: pr.number,
                prUrl: pr.html_url,
                headBranch: branchName,
                baseBranch: repo.defaultBranch,
                status: pr.state,
              },
            })
          } catch (prErr) {
            console.error('Failed to create PR:', prErr)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, processed: pendingJobs.length })
  } catch (err) {
    console.error('[GET /api/cron/process-jobs]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
