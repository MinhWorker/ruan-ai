import { Test, TestingModule } from '@nestjs/testing';
import { SignatureGuard } from './signature.guard';
import { ConfigService } from '../../config/config.service';
import {
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';

describe('SignatureGuard', () => {
  let guard: SignatureGuard;

  beforeEach(async () => {
    const mockConfigService = {
      githubWebhookSecret: 'test-secret',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<SignatureGuard>(SignatureGuard);
  });

  function createMockExecutionContext(
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): ExecutionContext {
    const request = {
      headers,
      rawBody,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw UnauthorizedException if X-Hub-Signature-256 header is missing', () => {
    const context = createMockExecutionContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'Missing X-Hub-Signature-256 header',
    );
  });

  it('should throw BadRequestException if rawBody is missing', () => {
    const context = createMockExecutionContext({
      'x-hub-signature-256': 'sha256=somesig',
    });
    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(() => guard.canActivate(context)).toThrow(
      'Raw request body is empty or unavailable',
    );
  });

  it('should throw UnauthorizedException if signature does not start with sha256=', () => {
    const context = createMockExecutionContext(
      { 'x-hub-signature-256': 'md5=somesig' },
      Buffer.from('body'),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow(
      'Invalid signature format',
    );
  });

  it('should throw UnauthorizedException if signature is a mismatch', () => {
    const rawBody = Buffer.from('hello-world');
    const wrongSig =
      'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const context = createMockExecutionContext(
      { 'x-hub-signature-256': wrongSig },
      rawBody,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Signature mismatch');
  });

  it('should return true for a correct signature', () => {
    const rawBody = Buffer.from('{"hello":"world"}');
    const hmac = crypto.createHmac('sha256', 'test-secret');
    hmac.update(rawBody);
    const correctSig = `sha256=${hmac.digest('hex')}`;

    const context = createMockExecutionContext(
      { 'x-hub-signature-256': correctSig },
      rawBody,
    );
    expect(guard.canActivate(context)).toBe(true);
  });
});
