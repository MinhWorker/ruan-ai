import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class SignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const signature = request.headers['x-hub-signature-256'] as
      | string
      | undefined;

    if (!signature) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const secret = this.configService.githubWebhookSecret;
    const rawBody = request.rawBody;

    if (!rawBody) {
      throw new BadRequestException('Raw request body is empty or unavailable');
    }

    if (!signature.startsWith('sha256=')) {
      throw new UnauthorizedException(
        'Invalid signature format. Must start with sha256=',
      );
    }

    const hash = signature.substring(7); // strip 'sha256='
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedHash = hmac.digest('hex');

    if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
      throw new UnauthorizedException('Invalid hex signature');
    }

    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

    if (
      hashBuffer.length !== expectedHashBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, expectedHashBuffer)
    ) {
      throw new UnauthorizedException('Signature mismatch');
    }

    return true;
  }
}
