import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.['gh_helper_token'];

    if (!token) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Not logged in' });
    }

    try {
      const secret = this.config.get<string>('JWT_SECRET')!;
      const payload = jwt.verify(token, secret) as any;
      req.user = { userId: BigInt(payload.userId), githubLogin: payload.githubLogin };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }
  }
}
