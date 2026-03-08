import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubService } from '../github/github.service';

@Injectable()
export class ReposService {
  constructor(private prisma: PrismaService, private github: GitHubService) {}

  async importRepo(userId: bigint, repoUrl: string) {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new NotFoundException({ code: 'VALIDATION_ERROR', message: 'Invalid GitHub repo URL' });
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    const installation = await this.github.getRepoInstallation(owner, cleanRepo);
    if (!installation) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'GitHub App not installed for this repo' });
    }

    const repoInfo = await this.github.getRepoInfo(installation.id, owner, cleanRepo);

    const existing = await this.prisma.repository.findUnique({ where: { githubRepoId: repoInfo.id } });
    if (existing) {
      return {
        id: Number(existing.id),
        fullName: existing.fullName,
        defaultBranch: existing.defaultBranch,
        installationId: Number(existing.installationId),
      };
    }

    const record = await this.prisma.repository.create({
      data: {
        ownerGithubId: userId,
        githubRepoId: repoInfo.id,
        fullName: repoInfo.full_name,
        ownerLogin: owner,
        repoName: cleanRepo,
        defaultBranch: repoInfo.default_branch,
        installationId: BigInt(installation.id),
      },
    });

    return {
      id: Number(record.id),
      fullName: record.fullName,
      defaultBranch: record.defaultBranch,
      installationId: Number(record.installationId),
    };
  }

  async listRepos(userId: bigint) {
    const repos = await this.prisma.repository.findMany({
      where: { ownerGithubId: userId, isActive: true },
      include: { config: true },
      orderBy: { createdAt: 'desc' },
    });

    return repos.map((r) => ({
      id: Number(r.id),
      fullName: r.fullName,
      defaultBranch: r.defaultBranch,
      isActive: r.isActive,
      config: r.config
        ? {
            baseLanguage: r.config.baseLanguage,
            targetLanguages: r.config.targetLanguages,
            readmeLinksEnabled: r.config.readmeLinksEnabled,
            runMode: r.config.runMode,
          }
        : null,
    }));
  }

  async getTree(repoId: bigint) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repoId } });
    if (!repo) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Repository not found' });

    const files = await this.github.getRepoTree(
      Number(repo.installationId), repo.ownerLogin, repo.repoName, repo.defaultBranch,
    );

    return { defaultBranch: repo.defaultBranch, markdownFiles: files };
  }

  async saveConfig(repoId: bigint, dto: {
    baseLanguage: string; targetLanguages: string[];
    readmeLinksEnabled: boolean; runMode: string; userApiKeyId?: number | null;
    outputDir?: string;
  }) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repoId } });
    if (!repo) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Repository not found' });

    return this.prisma.translationConfig.upsert({
      where: { repoId },
      create: {
        repoId,
        baseLanguage: dto.baseLanguage,
        targetLanguages: dto.targetLanguages,
        outputDir: dto.outputDir || 'translate',
        readmeLinksEnabled: dto.readmeLinksEnabled,
        runMode: dto.runMode,
        userApiKeyId: dto.userApiKeyId ? BigInt(dto.userApiKeyId) : null,
      },
      update: {
        baseLanguage: dto.baseLanguage,
        targetLanguages: dto.targetLanguages,
        outputDir: dto.outputDir || 'translate',
        readmeLinksEnabled: dto.readmeLinksEnabled,
        runMode: dto.runMode,
        userApiKeyId: dto.userApiKeyId ? BigInt(dto.userApiKeyId) : null,
      },
    });
  }

  async saveTrackedDocs(repoId: bigint, sourcePaths: string[]) {
    const repo = await this.prisma.repository.findUnique({ where: { id: repoId } });
    if (!repo) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Repository not found' });

    await this.prisma.$transaction(async (tx) => {
      await tx.trackedDocument.updateMany({ where: { repoId }, data: { isActive: false } });
      for (const path of sourcePaths) {
        await tx.trackedDocument.upsert({
          where: { repoId_sourcePath: { repoId, sourcePath: path } },
          create: { repoId, sourcePath: path, isActive: true },
          update: { isActive: true },
        });
      }
    });
  }

  async getTrackedDocs(repoId: bigint) {
    const docs = await this.prisma.trackedDocument.findMany({
      where: { repoId, isActive: true },
    });
    return docs.map((d) => d.sourcePath);
  }
}
