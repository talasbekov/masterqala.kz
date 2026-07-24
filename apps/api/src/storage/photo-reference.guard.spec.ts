import { PhotoReferenceGuard } from './photo-reference.guard';

describe('PhotoReferenceGuard', () => {
  const validPath = '123e4567-e89b-42d3-a456-426614174000.jpg';

  it('пропускает существующие канонические photo paths', async () => {
    const storage = { exists: jest.fn().mockResolvedValue(true) };
    const guard = new PhotoReferenceGuard(storage as never);

    await expect(guard.assertAvailable([validPath])).resolves.toBeUndefined();
    expect(storage.exists).toHaveBeenCalledWith(validPath);
  });

  it('отклоняет path traversal и неподдерживаемое расширение до обращения к storage', async () => {
    const storage = { exists: jest.fn() };
    const guard = new PhotoReferenceGuard(storage as never);

    await expect(guard.assertAvailable(['../secret.jpg'])).rejects.toThrow('Некорректная ссылка');
    await expect(
      guard.assertAvailable(['123e4567-e89b-42d3-a456-426614174000.pdf']),
    ).rejects.toThrow('Некорректная ссылка');
    expect(storage.exists).not.toHaveBeenCalled();
  });

  it('отклоняет ссылку на отсутствующий файл', async () => {
    const storage = { exists: jest.fn().mockResolvedValue(false) };
    const guard = new PhotoReferenceGuard(storage as never);

    await expect(guard.assertAvailable([validPath])).rejects.toThrow('Загруженное фото не найдено');
  });
});
