import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly webhookSecret: string;

  constructor(
    private prisma: PrismaService,
    private jobsService: JobsService,
    private config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('GITHUB_WEBHOOK_SECRET', '');
  }

  verifySignature(payload: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return true;
    const expected = 'sha256=' + createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handlePushEvent(deliveryId: string, payload: any) {
    const existing = await this.prisma.webhookDelivery.findUnique({ where: { deliveryId } });
    if (existing) {
      this.logger.warn(`Duplicate webhook delivery: ${deliveryId}`);
      return;
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return;

    const repo = await this.prisma.repository.findFirst({
      where: { fullName: repoFullName, isActive: true },
      include: { config: true, trackedDocuments: { where: { isActive: true } } },
    });

    let repoId: bigint | null = repo?.id || null;

    await this.prisma.webhookDelivery.create({
      data: {
        deliveryId,
        eventType: 'push',
        repoId,
        payload,
        processedStatus: 'received',
      },
    });

    if (!repo || !repo.config) {
      await this.prisma.webhookDelivery.update({
        where: { deliveryId },
        data: { processedStatus: 'skipped', processedAt: new Date() },
      });
      return;
    }

    const ref = payload.ref as string;
    if (ref !== `refs/heads/${repo.defaultBranch}`) {
      await this.prisma.webhookDelivery.update({
        where: { deliveryId },
        data: { processedStatus: 'skipped', processedAt: new Date() },
      });
      return;
    }

    const changedFiles: string[] = [];
    for (const commit of payload.commits || []) {
      changedFiles.push(...(commit.added || []), ...(commit.modified || []));
    }

    const trackedPaths = new Set(repo.trackedDocuments.map((d) => d.sourcePath));
    const affectedPaths = [...new Set(changedFiles)].filter((f) => trackedPaths.has(f));

    if (affectedPaths.length === 0) {
      await this.prisma.webhookDelivery.update({
        where: { deliveryId },
        data: { processedStatus: 'skipped', processedAt: new Date() },
      });
      return;
    }

    this.logger.log(`Push event affects ${affectedPaths.length} tracked docs in ${repoFullName}`);

    try {
      await this.jobsService.createManualJob(repo.id, 'incremental');
      await this.prisma.webhookDelivery.update({
        where: { deliveryId },
        data: { processedStatus: 'processed', processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Failed to create incremental job: ${err.message}`);
      await this.prisma.webhookDelivery.update({
        where: { deliveryId },
        data: { processedStatus: 'error', errorMessage: err.message, processedAt: new Date() },
      });
    }
  }
}
