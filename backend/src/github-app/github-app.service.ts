import { Injectable } from '@nestjs/common';
import { GitHubService } from '../github/github.service';

const APP_SLUG = 'GitHub-translator-helper-app';

@Injectable()
export class GitHubAppService {
  constructor(private github: GitHubService) {}

  getInstallUrl() {
    return {
      appName: APP_SLUG,
      installUrl: `https://github.com/apps/${APP_SLUG}/installations/new`,
    };
  }

  async getUserInstallations(githubLogin: string) {
    const all = await this.github.listInstallations();
    return all
      .filter((i) => i.account?.login?.toLowerCase() === githubLogin.toLowerCase())
      .map((i) => ({
        installationId: i.id,
        accountLogin: i.account?.login,
        accountType: i.account?.type,
      }));
  }
}
