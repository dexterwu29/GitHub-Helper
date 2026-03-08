import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, fingerprint } from '../common/utils/crypto';

@Injectable()
export class KeysService {
  private readonly encKey: string;

  constructor(private prisma: PrismaService, config: ConfigService) {
    this.encKey = config.get<string>('ENCRYPTION_KEY')!;
  }

  async addKey(userId: bigint, provider: string, apiKey: string) {
    const fp = fingerprint(apiKey);
    const encrypted = encrypt(apiKey, this.encKey);

    const record = await this.prisma.userApiKey.create({
      data: { userId, provider, encryptedKey: encrypted, keyFingerprint: fp },
    });

    return { id: Number(record.id), provider, keyFingerprint: fp, isActive: true };
  }

  async listKeys(userId: bigint, provider: string) {
    const keys = await this.prisma.userApiKey.findMany({
      where: { userId, provider, isActive: true },
    });
    return keys.map((k) => ({
      id: Number(k.id),
      provider: k.provider,
      keyFingerprint: k.keyFingerprint,
      isActive: k.isActive,
    }));
  }

  async deleteKey(userId: bigint, keyId: bigint) {
    const key = await this.prisma.userApiKey.findFirst({ where: { id: keyId, userId } });
    if (!key) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Key not found' });

    await this.prisma.userApiKey.update({ where: { id: keyId }, data: { isActive: false } });
  }

  async getDecryptedKey(keyId: bigint): Promise<string> {
    const key = await this.prisma.userApiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Key not found' });
    return decrypt(key.encryptedKey, this.encKey);
  }
}
