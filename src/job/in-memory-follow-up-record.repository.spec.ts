import { InMemoryFollowUpRecordRepository } from './in-memory-follow-up-record.repository';
import { FollowUpRecord } from './interfaces/follow-up-record.interface';

describe('InMemoryFollowUpRecordRepository', () => {
  let repo: InMemoryFollowUpRecordRepository;

  beforeEach(() => {
    repo = new InMemoryFollowUpRecordRepository();
  });

  const mockRecord: FollowUpRecord = {
    id: '1',
    issueNumber: 1,
    repositoryOwner: 'owner',
    repositoryName: 'repo',
    workflow: 'status',
    dueAt: new Date(),
    status: 'pending',
    reason: 'test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should save and find by id', async () => {
    await repo.save(mockRecord);
    const found = await repo.findById('1');
    expect(found).toEqual(mockRecord);
  });

  it('should find pending by issue', async () => {
    await repo.save(mockRecord);
    await repo.save({ ...mockRecord, id: '2', status: 'completed' });

    const pending = await repo.findPendingByIssue(1, 'owner', 'repo');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('1');
  });

  it('should update status', async () => {
    await repo.save(mockRecord);
    const updated = await repo.updateStatus('1', 'inactive');
    expect(updated.status).toBe('inactive');

    const found = await repo.findById('1');
    expect(found?.status).toBe('inactive');
  });
});
