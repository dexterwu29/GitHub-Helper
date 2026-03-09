import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { getInstallationOctokit, getFileContent, createOrUpdateFile, getFileSha, createBranch, createPullRequest } from '@/lib/server/github'
import { translateMarkdown } from '@/lib/server/translation'
import { decrypt } from '@/lib/server/crypto'

/** 测试阶段：每个仓库平台额度可调用翻译任务数 */
const PLATFORM_QUOTA_PER_REPO = 100

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
      if (!repo) {
        console.warn('[process-jobs] Repo not found for job', job.id)
        continue
      }

      const config = await prisma.translationConfig.findUnique({
        where: { repoId: repo.id },
      })
      if (!config) {
        console.warn('[process-jobs] No translation config for repo', repo.fullName)
        continue
      }

      let apiKey = process.env.OPENROUTER_API_KEY_PLATFORM || ''
      if (config.runMode === 'byoKey' && config.userApiKeyId) {
        const userKey = await prisma.userApiKey.findUnique({
          where: { id: config.userApiKeyId },
        })
        if (userKey) apiKey = decrypt(userKey.encryptedKey)
      }

      const keyValid = apiKey && apiKey.length > 10 && !apiKey.toLowerCase().includes('never-use')
      if (!keyValid) {
        console.error('[process-jobs] Invalid or missing OpenRouter API key. Set OPENROUTER_API_KEY_PLATFORM in .env with your key from https://openrouter.ai/keys')
        await prisma.translationJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: '平台 OpenRouter API Key 未配置或无效，请在 .env 中设置 OPENROUTER_API_KEY_PLATFORM',
            finishedAt: new Date(),
          },
        })
        continue
      }

      if (config.runMode === 'platform') {
        const usedCount = await prisma.translationJobItem.count({
          where: {
            repoId: repo.id,
            status: 'completed',
          },
        })
        if (usedCount >= PLATFORM_QUOTA_PER_REPO) {
          console.warn('[process-jobs] Repo quota exceeded', repo.fullName, usedCount, PLATFORM_QUOTA_PER_REPO)
          await prisma.translationJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              errorMessage: `平台额度已用尽（${usedCount}/${PLATFORM_QUOTA_PER_REPO}），请使用「自带 API Key」模式`,
              finishedAt: new Date(),
            },
          })
          continue
        }
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
        console.log('[process-jobs] Translating', item.sourcePath, '->', item.targetLanguage)

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
          console.error('[process-jobs] Item failed', item.sourcePath, item.targetLanguage, msg)
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
            const prMsg = prErr instanceof Error ? prErr.message : String(prErr)
            console.error('[process-jobs] Failed to create PR for job', job.id, prMsg)
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
