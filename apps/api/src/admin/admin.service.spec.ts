import { AdminService } from './admin.service';

describe('AdminService decision document race', () => {
  it('checks document safety after obtaining the profile lock, including an upload that won the lock', async () => {
    let uploadCommitted = false;
    const profile = { id: 'profile-1', status: 'PENDING_REVIEW' };
    const prisma = {
      masterProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...profile, status: 'ACTIVE' }),
      },
      verificationDecision: { create: jest.fn() },
      $queryRaw: jest.fn(async (query: TemplateStringsArray) => {
        if (query.join('').includes('FOR UPDATE')) {
          // The earlier upload commits before this decision obtains the row lock.
          uploadCommitted = true;
          return [{ id: profile.id }];
        }
        return [{ count: uploadCommitted ? 1 : 0 }];
      }),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) => work(prisma));
    const audit = { write: jest.fn() };
    const service = new AdminService(prisma as never, {} as never, audit as never);

    await expect(service.decide('operator-1', profile.id, { decision: 'APPROVE' })).rejects.toMatchObject({ status: 409 });
    expect(prisma.masterProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.verificationDecision.create).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
});
