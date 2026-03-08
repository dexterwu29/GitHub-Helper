import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GitHubModule } from './github/github.module';
import { GitHubAppModule } from './github-app/github-app.module';
import { ReposModule } from './repos/repos.module';
import { KeysModule } from './keys/keys.module';
import { JobsModule } from './jobs/jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TranslationModule } from './translation/translation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    GitHubModule,
    GitHubAppModule,
    ReposModule,
    KeysModule,
    JobsModule,
    WebhooksModule,
    TranslationModule,
  ],
})
export class AppModule {}
