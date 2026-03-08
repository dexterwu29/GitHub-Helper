import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubService } from '../github/github.service';
import { TranslationService } from '../translation/translation.service';
import { decrypt } from '../common/utils/crypto';

type AnyJob = any;

@Injectable()
export class JobWorkerService {
  private readonly logger = new Logger(JobWorkerService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private github: GitHubService,
    private translation: TranslationService,
    private config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async pollJobs() {
    if (this.processing) return;
    this.processing = true;

    try {
      const job = await this.prisma.translationJob.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        include: {
          repo: { include: { config: true } },
          items: { where: { status: 'pending' } },
        },
      });

      if (!job) return;

      await this.prisma.translationJob.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: new Date() },
      });

      await this.executeJob(job);
    } catch (err) {
      this.logger.error('Worker poll error', err);
    } finally {
      this.processing = false;
    }
  }

  private async executeJob(job: any) {
    const repo = job.repo;
    const config = repo.config;
    if (!config) {
      await this.failJob(job.id, 'Missing translation config');
      return;
    }

    const apiKey = await this.resolveApiKey(config);
    if (!apiKey) {
      await this.failJob(job.id, 'No API key available');
      return;
    }

    const installationId = Number(repo.installationId);
    const branchName = `translate/${job.triggerType}-${Date.now()}`;

    try {
      const baseSha = await this.github.getDefaultBranchSha(
        installationId, repo.ownerLogin, repo.repoName, repo.defaultBranch,
      );
      await this.github.createBranch(installationId, repo.ownerLogin, repo.repoName, branchName, baseSha);
    } catch (err) {
      await this.failJob(job.id, `Failed to create branch: ${err.message}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of job.items) {
      try {
        await this.prisma.translationJobItem.update({
          where: { id: item.id },
          data: { status: 'running', attempt: { increment: 1 } },
        });

        const sourceContent = await this.github.getFileContent(
          installationId, repo.ownerLogin, repo.repoName, item.sourcePath, repo.defaultBranch,
        );

        const translated = await this.translation.translate(
          sourceContent, config.baseLanguage, item.targetLanguage, apiKey, item.sourcePath,
        );

        const existingSha = await this.github.getFileSha(
          installationId, repo.ownerLogin, repo.repoName, item.outputPath, branchName,
        );

        await this.github.createOrUpdateFile(
          installationId, repo.ownerLogin, repo.repoName,
          item.outputPath, translated,
          `translate: ${item.sourcePath} → ${item.targetLanguage}`,
          branchName, existingSha || undefined,
        );

        await this.prisma.translationJobItem.update({
          where: { id: item.id },
          data: { status: 'success' },
        });
        successCount++;
      } catch (err) {
        this.logger.error(`Item ${item.id} failed: ${err.message}`);
        await this.prisma.translationJobItem.update({
          where: { id: item.id },
          data: { status: 'failed', errorMessage: err.message?.slice(0, 500) },
        });
        failCount++;
      }
    }

    if (successCount > 0) {
      try {
        const prData = await this.github.createPullRequest(
          installationId, repo.ownerLogin, repo.repoName,
          `[GitHub Helper] Auto-translate (${new Date().toISOString().slice(0, 10)})`,
          this.buildPrBody(successCount, failCount, config),
          branchName, repo.defaultBranch,
        );

        await this.prisma.pullRequest.create({
          data: {
            repoId: repo.id,
            jobId: job.id,
            prNumber: prData.number,
            prUrl: prData.html_url,
            headBranch: branchName,
            baseBranch: repo.defaultBranch,
            status: 'open',
          },
        });
      } catch (err) {
        this.logger.error(`PR creation failed: ${err.message}`);
      }
    }

    const finalStatus = failCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial_success';
    await this.prisma.translationJob.update({
      where: { id: job.id },
      data: { status: finalStatus, finishedAt: new Date() },
    });
  }

  private async resolveApiKey(config: any): Promise<string | null> {
    if (config.runMode === 'bring_your_key' && config.userApiKeyId) {
      try {
        const key = await this.prisma.userApiKey.findUnique({ where: { id: config.userApiKeyId } });
        if (key) return decrypt(key.encryptedKey, this.config.get<string>('ENCRYPTION_KEY')!);
      } catch {
        return null;
      }
    }
    return this.config.get<string>('OPENROUTER_API_KEY_PLATFORM') || null;
  }

  private async failJob(jobId: bigint, message: string) {
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: message, finishedAt: new Date() },
    });
  }

  private buildPrBody(success: number, failed: number, config: any): string {
    const langs = (config.targetLanguages as string[]).join(', ');
    return `## Auto-generated Translation PR

- **Base language**: ${config.baseLanguage}
- **Target languages**: ${langs}
- **Items translated**: ${success} success, ${failed} failed
- **Generated by**: [GitHub Helper](https://github-helper.app)

> This PR was automatically created by GitHub Helper translation assistant.`;
  }
}
