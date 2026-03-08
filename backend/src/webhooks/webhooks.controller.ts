import { Controller, Post, Req, Headers, ForbiddenException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/github')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private webhooksService: WebhooksService) {}

  @Post()
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    const rawBody = (req as any).rawBody;
    if (rawBody && signature) {
      const valid = this.webhooksService.verifySignature(rawBody, signature);
      if (!valid) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Invalid webhook signature' });
      }
    }

    this.logger.log(`Webhook event: ${event}, delivery: ${deliveryId}`);

    if (event === 'push') {
      await this.webhooksService.handlePushEvent(deliveryId, req.body);
    }

    return { __raw: true, value: { received: true } };
  }
}
