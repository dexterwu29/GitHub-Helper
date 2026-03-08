import { Module } from '@nestjs/common';
import { GitHubAppController } from './github-app.controller';
import { GitHubAppService } from './github-app.service';

@Module({
  controllers: [GitHubAppController],
  providers: [GitHubAppService],
})
export class GitHubAppModule {}
