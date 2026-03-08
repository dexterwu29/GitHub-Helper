import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobWorkerService } from './job-worker.service';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  controllers: [JobsController],
  providers: [JobsService, JobWorkerService],
  exports: [JobsService],
})
export class JobsModule {}
