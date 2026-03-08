import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private config: ConfigService) {
    this.appId = config.get<string>('GITHUB_APP_ID')!;
    this.privateKey = config.get<string>('GITHUB_APP_PRIVATE_KEY')!.replace(/\\n/g, '\n');
    this.clientId = config.get<string>('GITHUB_APP_CLIENT_ID')!;
    this.clientSecret = config.get<string>('GITHUB_APP_CLIENT_SECRET')!;
  }

  getOAuthLoginUrl(state: string): string {
    return `https://github.com/login/oauth/authorize?client_id=${this.clientId}&state=${state}&scope=read:user,user:email`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`OAuth error: ${data.error_description || data.error}`);
    return data.access_token;
  }

  async getAuthenticatedUser(accessToken: string) {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.users.getAuthenticated();
    return data;
  }

  getInstallationOctokit(installationId: number): Octokit {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId,
      },
    });
  }

  async listInstallations(): Promise<any[]> {
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: this.appId, privateKey: this.privateKey },
    });
    const { data } = await octokit.apps.listInstallations();
    return data;
  }

  async getRepoInstallation(owner: string, repo: string): Promise<any> {
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: this.appId, privateKey: this.privateKey },
    });
    const { data } = await octokit.apps.getRepoInstallation({ owner, repo });
    return data;
  }

  async getRepoTree(installationId: number, owner: string, repo: string, branch: string) {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: 'true' });
    return data.tree
      .filter((item) => item.type === 'blob' && item.path?.endsWith('.md'))
      .map((item) => item.path!);
  }

  async getFileContent(installationId: number, owner: string, repo: string, path: string, ref: string): Promise<string> {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref }) as any;
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async getRepoInfo(installationId: number, owner: string, repo: string) {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.get({ owner, repo });
    return data;
  }

  async createOrUpdateFile(
    installationId: number, owner: string, repo: string,
    path: string, content: string, message: string, branch: string, sha?: string,
  ) {
    const octokit = this.getInstallationOctokit(installationId);
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    return octokit.repos.createOrUpdateFileContents({
      owner, repo, path, message, content: encoded, branch, ...(sha ? { sha } : {}),
    });
  }

  async createBranch(installationId: number, owner: string, repo: string, branchName: string, fromSha: string) {
    const octokit = this.getInstallationOctokit(installationId);
    try {
      await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: fromSha });
    } catch (e: any) {
      if (e.status === 422) {
        this.logger.warn(`Branch ${branchName} already exists, reusing`);
      } else {
        throw e;
      }
    }
  }

  async getDefaultBranchSha(installationId: number, owner: string, repo: string, branch: string): Promise<string> {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return data.object.sha;
  }

  async createPullRequest(
    installationId: number, owner: string, repo: string,
    title: string, body: string, head: string, base: string,
  ) {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.pulls.create({ owner, repo, title, body, head, base });
    return data;
  }

  async getFileSha(installationId: number, owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    const octokit = this.getInstallationOctokit(installationId);
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref }) as any;
      return data.sha;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async getCompareCommits(installationId: number, owner: string, repo: string, base: string, head: string) {
    const octokit = this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.compareCommits({ owner, repo, base, head });
    return data.files?.map((f) => f.filename) || [];
  }
}
