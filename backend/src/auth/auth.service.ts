import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubService } from '../github/github.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private github: GitHubService,
    private config: ConfigService,
  ) {}

  getLoginUrl(): { url: string; state: string } {
    const state = randomBytes(16).toString('hex');
    return { url: this.github.getOAuthLoginUrl(state), state };
  }

  async handleCallback(code: string) {
    const accessToken = await this.github.exchangeCodeForToken(code);
    const ghUser = await this.github.getAuthenticatedUser(accessToken);

    const user = await this.prisma.user.upsert({
      where: { githubUserId: ghUser.id },
      update: { githubLogin: ghUser.login, githubAvatarUrl: ghUser.avatar_url, email: ghUser.email },
      create: {
        githubUserId: ghUser.id,
        githubLogin: ghUser.login,
        githubAvatarUrl: ghUser.avatar_url,
        email: ghUser.email,
      },
    });

    const secret = this.config.get<string>('JWT_SECRET')!;
    const token = jwt.sign(
      { userId: user.id.toString(), githubLogin: user.githubLogin },
      secret,
      { expiresIn: '7d' },
    );

    return { token, user };
  }

  async getMe(userId: bigint) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: Number(user.id),
      githubLogin: user.githubLogin,
      githubUserId: Number(user.githubUserId),
      avatarUrl: user.githubAvatarUrl,
    };
  }
}
