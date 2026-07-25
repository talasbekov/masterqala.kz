import { PhotoReferenceGuard } from './photo-reference.guard';

describe('PhotoReferenceGuard', () => {
  const userId = 'user-1';
  const validPath = '123e4567-e89b-42d3-a456-426614174000.jpg';

  function setup(count: number, exists: boolean) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ count: BigInt(count) }]) };
    const storage = { exists: jest.fn().mockResolvedValue(exists) };
    return {
      guard: new PhotoReferenceGuard(prisma as never, storage as never),
      prisma,
      storage,
    };
  }

  it('пропускает только CLEAN upload владельца до TTL и consume', async () => {
    const { guard, prisma, storage } = setup(1, true);

    await expect(guard.assertAvailable(userId, [validPath])).resolves.toBeUndefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.exists).toHaveBeenCalledWith(validPath);
  });

  it('отклоняет path traversal до обращения к БД и storage', async () => {
    const { guard, prisma, storage } = setup(0, false);

    await expect(guard.assertAvailable(userId, ['../secret.jpg'])).rejects.toThrow('Некорректная ссылка');
    await expect(
      guard.assertAvailable(userId, ['123e4567-e89b-42d3-a456-426614174000.pdf']),
    ).rejects.toThrow('Некорректная ссылка');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(storage.exists).not.toHaveBeenCalled();
  });

  it('не раскрывает, upload чужой, не CLEAN, истёк или уже использован', async () => {
    const { guard, storage } = setup(0, true);

    await expect(guard.assertAvailable('other-user', [validPath])).rejects.toThrow(
      'Фото недоступно, не прошло проверку, истекло или уже использовано',
    );
    expect(storage.exists).not.toHaveBeenCalled();
  });

  it('отклоняет запись, если файл исчез из storage после CLEAN', async () => {
    const { guard } = setup(1, false);

    await expect(guard.assertAvailable(userId, [validPath])).rejects.toThrow('Загруженное фото не найдено');
  });
});
