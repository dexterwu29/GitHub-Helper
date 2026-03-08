import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private config: ConfigService) {}

  @Get('github/login')
  login(@Res() res: Response) {
    const { url } = this.authService.getLoginUrl();
    res.redirect(url);
  }

  @Get('github/callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const { token } = await this.authService.handleCallback(code);
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    res.cookie('gh_helper_token', token, {
      httpOnly: true,
      secure: this.config.get('APP_ENV') !== 'local',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getMe(user.userId);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('gh_helper_token', { path: '/' });
    res.json({ success: true, data: null });
  }
}
