import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('should return status ok and a valid timestamp', () => {
      const res = healthController.getHealth();
      expect(res.status).toBe('ok');
      expect(res.timestamp).toBeDefined();
      expect(isNaN(Date.parse(res.timestamp))).toBe(false);
    });
  });
});
