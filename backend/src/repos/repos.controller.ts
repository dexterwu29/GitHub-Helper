import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ReposService } from './repos.service';

@Controller('repos')
@UseGuards(AuthGuard)
export class ReposController {
  constructor(private reposService: ReposService) {}

  @Post('import')
  async importRepo(@CurrentUser() user: CurrentUserPayload, @Body('repoUrl') repoUrl: string) {
    return this.reposService.importRepo(user.userId, repoUrl);
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    return this.reposService.listRepos(user.userId);
  }

  @Get(':repoId/tree')
  async tree(@Param('repoId') repoId: string) {
    return this.reposService.getTree(BigInt(repoId));
  }

  @Put(':repoId/config')
  async saveConfig(@Param('repoId') repoId: string, @Body() body: any) {
    await this.reposService.saveConfig(BigInt(repoId), body);
    return { saved: true };
  }

  @Put(':repoId/tracked-docs')
  async saveTrackedDocs(@Param('repoId') repoId: string, @Body('sourcePaths') sourcePaths: string[]) {
    await this.reposService.saveTrackedDocs(BigInt(repoId), sourcePaths);
    return { saved: true };
  }

  @Get(':repoId/tracked-docs')
  async getTrackedDocs(@Param('repoId') repoId: string) {
    return this.reposService.getTrackedDocs(BigInt(repoId));
  }
}
