import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { JobsService } from './jobs.service';

@Controller()
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Post('repos/:repoId/jobs/translate')
  async createJob(@Param('repoId') repoId: string, @Body('mode') mode: string) {
    return this.jobsService.createManualJob(BigInt(repoId), mode || 'full');
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    return this.jobsService.getJobDetail(BigInt(jobId));
  }

  @Get('repos/:repoId/jobs')
  async listJobs(
    @Param('repoId') repoId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.jobsService.listJobs(BigInt(repoId), parseInt(page) || 1, parseInt(pageSize) || 10);
  }

  @Post('jobs/:jobId/retry')
  async retryJob(@Param('jobId') jobId: string) {
    return this.jobsService.retryJob(BigInt(jobId));
  }

  @Post('jobs/:jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string) {
    return this.jobsService.cancelJob(BigInt(jobId));
  }

  @Get('repos/:repoId/pull-requests')
  async listPRs(
    @Param('repoId') repoId: string,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.jobsService.listPullRequests(BigInt(repoId), status || undefined, parseInt(page) || 1, parseInt(pageSize) || 10);
  }
}
