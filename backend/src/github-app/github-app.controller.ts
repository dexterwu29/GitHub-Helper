import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { GitHubAppService } from './github-app.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('github-app')
@UseGuards(AuthGuard)
export class GitHubAppController {
  constructor(private ghAppService: GitHubAppService) {}

  @Get('install-url')
  getInstallUrl() {
    return this.ghAppService.getInstallUrl();
  }

  @Get('installations')
  async getInstallations(@CurrentUser() user: CurrentUserPayload) {
    return this.ghAppService.getUserInstallations(user.githubLogin);
  }
}
