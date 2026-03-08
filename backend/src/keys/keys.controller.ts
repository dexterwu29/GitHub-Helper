import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { KeysService } from './keys.service';

@Controller('keys/openrouter')
@UseGuards(AuthGuard)
export class KeysController {
  constructor(private keysService: KeysService) {}

  @Post()
  async addKey(@CurrentUser() user: CurrentUserPayload, @Body('apiKey') apiKey: string) {
    return this.keysService.addKey(user.userId, 'openrouter', apiKey);
  }

  @Get()
  async listKeys(@CurrentUser() user: CurrentUserPayload) {
    return this.keysService.listKeys(user.userId, 'openrouter');
  }

  @Delete(':keyId')
  async deleteKey(@CurrentUser() user: CurrentUserPayload, @Param('keyId') keyId: string) {
    await this.keysService.deleteKey(user.userId, BigInt(keyId));
    return { deleted: true };
  }
}
