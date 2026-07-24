import { BadRequestException } from '@nestjs/common';
import { sanitizeOriginalFilename, validateUploadedFile } from './upload-security';

function file(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('upload security', () => {
  it('принимает JPEG, PNG и PDF по фактической сигнатуре', () => {
    const jpeg = validateUploadedFile(
      file(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg', 'photo.jpeg'),
      ['jpeg'],
      1024,
    );
    const png = validateUploadedFile(
      file(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), 'image/png', 'photo.png'),
      ['png'],
      1024,
    );
    const pdf = validateUploadedFile(
      file(Buffer.from('%PDF-1.7\ncontent', 'ascii'), 'application/pdf', 'document.pdf'),
      ['pdf'],
      1024,
    );

    expect(jpeg).toMatchObject({ kind: 'jpeg', extension: 'jpg', mimeType: 'image/jpeg' });
    expect(png).toMatchObject({ kind: 'png', extension: 'png', mimeType: 'image/png' });
    expect(pdf).toMatchObject({ kind: 'pdf', extension: 'pdf', mimeType: 'application/pdf' });
  });

  it('отклоняет MIME spoofing', () => {
    const disguisedPng = file(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/jpeg',
      'photo.jpg',
    );

    expect(() => validateUploadedFile(disguisedPng, ['jpeg', 'png'], 1024)).toThrow(
      'MIME-тип файла не соответствует',
    );
  });

  it('отклоняет несоответствующее расширение и двойное расширение', () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    expect(() => validateUploadedFile(file(jpegBytes, 'image/jpeg', 'photo.png'), ['jpeg'], 1024)).toThrow(
      'Расширение файла не соответствует',
    );
    expect(() => validateUploadedFile(file(jpegBytes, 'image/jpeg', 'photo.jpg.exe'), ['jpeg'], 1024)).toThrow(
      'Расширение файла не соответствует',
    );
  });

  it('отклоняет неизвестную сигнатуру, пустой и слишком большой файл', () => {
    expect(() =>
      validateUploadedFile(file(Buffer.from('not-an-image'), 'image/png', 'photo.png'), ['png'], 1024),
    ).toThrow('Тип файла не разрешён');
    expect(() => validateUploadedFile(file(Buffer.alloc(0), 'image/png', 'photo.png'), ['png'], 1024)).toThrow(
      'Файл пустой',
    );
    expect(() =>
      validateUploadedFile(
        file(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]), 'image/jpeg', 'photo.jpg'),
        ['jpeg'],
        10,
      ),
    ).toThrow('Файл больше');
  });

  it('не разрешает PDF в image-only контексте', () => {
    expect(() =>
      validateUploadedFile(file(Buffer.from('%PDF-1.7', 'ascii'), 'application/pdf', 'doc.pdf'), ['jpeg', 'png'], 1024),
    ).toThrow(BadRequestException);
  });

  it('очищает пути, управляющие и bidi-символы в исходном имени', () => {
    expect(sanitizeOriginalFilename('../паспорт\u202e.exe.pdf', 'pdf')).toBe('_паспорт.exe.pdf');
    expect(sanitizeOriginalFilename('..\\..\\photo.jpg', 'jpg')).toBe('_.._photo.jpg');
    expect(sanitizeOriginalFilename('\u0000\u0007', 'png')).toBe('file.png');
  });

  it('ограничивает длину имени и сохраняет расширение', () => {
    const sanitized = sanitizeOriginalFilename(`${'a'.repeat(300)}.pdf`, 'pdf');

    expect(sanitized).toHaveLength(180);
    expect(sanitized.endsWith('.pdf')).toBe(true);
  });
});
