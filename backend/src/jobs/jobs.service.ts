import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private prisma: PrismaService) {}

  async createManualJob(repoId: bigint, mode: string) {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId },
      include: { config: true, trackedDocuments: { where: { isActive: true } } },
    });

    if (!repo) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Repository not found' });
    if (!repo.config) throw new ConflictException({ code: 'CONFLICT', message: 'No translation config' });
    if (repo.trackedDocuments.length === 0) {
      throw new ConflictException({ code: 'CONFLICT', message: 'No tracked documents' });
    }

    const targetLangs = repo.config.targetLanguages as string[];
    const outputDir = repo.config.outputDir || 'translate';

    const job = await this.prisma.translationJob.create({
      data: {
        repoId,
        triggerType: 'manual',
        status: 'pending',
        payload: { mode },
      },
    });

    const items: Array<{ jobId: bigint; repoId: bigint; sourcePath: string; targetLanguage: string; outputPath: string; status: string }> = [];
    for (const doc of repo.trackedDocuments) {
      for (const lang of targetLangs) {
        items.push({
          jobId: job.id,
          repoId,
          sourcePath: doc.sourcePath,
          targetLanguage: lang,
          outputPath: `${outputDir}/${lang}/${doc.sourcePath}`,
          status: 'pending',
        });
      }
    }

    await this.prisma.translationJobItem.createMany({ data: items });

    return { jobId: Number(job.id), status: 'pending' };
  }

  async getJobDetail(jobId: bigint) {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
      include: {
        items: { select: { status: true } },
        prs: { select: { prNumber: true, prUrl: true }, take: 1 },
      },
    });

    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found' });

    const progress = { total: 0, pending: 0, running: 0, success: 0, failed: 0 };
    for (const item of job.items) {
      progress.total++;
      if (item.status === 'pending') progress.pending++;
      else if (item.status === 'running') progress.running++;
      else if (item.status === 'success') progress.success++;
      else if (item.status === 'failed') progress.failed++;
    }

    const pr = job.prs[0] || null;

    return {
      jobId: Number(job.id),
      repoId: Number(job.repoId),
      triggerType: job.triggerType,
      status: job.status,
      progress,
      pr: pr ? { prNumber: pr.prNumber, prUrl: pr.prUrl } : null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() || null,
      finishedAt: job.finishedAt?.toISOString() || null,
    };
  }

  async listJobs(repoId: bigint, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.translationJob.findMany({
        where: { repoId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, triggerType: true, status: true, createdAt: true },
      }),
      this.prisma.translationJob.count({ where: { repoId } }),
    ]);

    return {
      items: items.map((j) => ({
        jobId: Number(j.id),
        triggerType: j.triggerType,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async retryJob(jobId: bigint) {
    const job = await this.prisma.translationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found' });
    if (!['failed', 'partial_success'].includes(job.status)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Only failed/partial_success jobs can be retried' });
    }

    await this.prisma.$transaction([
      this.prisma.translationJobItem.updateMany({
        where: { jobId, status: 'failed' },
        data: { status: 'pending', errorMessage: null },
      }),
      this.prisma.translationJob.update({
        where: { id: jobId },
        data: { status: 'pending', errorMessage: null, finishedAt: null },
      }),
    ]);

    return { jobId: Number(jobId), status: 'pending' };
  }

  async cancelJob(jobId: bigint) {
    const job = await this.prisma.translationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Job not found' });
    if (!['pending', 'running'].includes(job.status)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Only pending/running jobs can be cancelled' });
    }

    await this.prisma.$transaction([
      this.prisma.translationJobItem.updateMany({
        where: { jobId, status: { in: ['pending', 'running'] } },
        data: { status: 'cancelled' },
      }),
      this.prisma.translationJob.update({
        where: { id: jobId },
        data: { status: 'cancelled', finishedAt: new Date() },
      }),
    ]);

    return { jobId: Number(jobId), status: 'cancelled' };
  }

  async listPullRequests(repoId: bigint, status: string | undefined, page: number, pageSize: number) {
    const where: any = { repoId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.pullRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pullRequest.count({ where }),
    ]);

    return {
      items: items.map((pr) => ({
        id: Number(pr.id),
        prNumber: pr.prNumber,
        prUrl: pr.prUrl,
        headBranch: pr.headBranch,
        status: pr.status,
        createdAt: pr.createdAt.toISOString(),
      })),
      total,
    };
  }
}
