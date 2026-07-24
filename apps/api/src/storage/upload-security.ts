import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

export type AllowedUploadKind = 'jpeg' | 'png' | 'pdf';

interface UploadTypeDefinition {
  extension: string;
  mimeType: string;
  acceptedExtensions: readonly string[];
  signature: Buffer;
}

const UPLOAD_TYPES: Record<AllowedUploadKind, UploadTypeDefinition> = {
  jpeg: {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    acceptedExtensions: ['.jpg', '.jpeg'],
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  png: {
    extension: 'png',
    mimeType: 'image/png',
    acceptedExtensions: ['.png'],
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  pdf: {
    extension: 'pdf',
    mimeType: 'application/pdf',
    acceptedExtensions: ['.pdf'],
    signature: Buffer.from('%PDF-', 'ascii'),
  },
};

const STORED_PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)$/i;

export interface ValidatedUpload {
  kind: AllowedUploadKind;
  extension: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

function detectKind(buffer: Buffer): AllowedUploadKind | null {
  for (const [kind, definition] of Object.entries(UPLOAD_TYPES) as [AllowedUploadKind, UploadTypeDefinition][]) {
    if (
      buffer.length >= definition.signature.length &&
      buffer.subarray(0, definition.signature.length).equals(definition.signature)
    ) {
      return kind;
    }
  }
  return null;
}

function originalExtension(originalName: string): string {
  const basename = originalName.split(/[\\/]/).pop() ?? '';
  return extname(basename).toLowerCase();
}

export function sanitizeOriginalFilename(originalName: string, fallbackExtension: string): string {
  const normalized = String(originalName ?? '')
    .normalize('NFKC')
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');

  const fallback = `file.${fallbackExtension}`;
  if (!normalized) return fallback;

  const maxLength = 180;
  if (normalized.length <= maxLength) return normalized;

  const extension = extname(normalized);
  const stemLimit = Math.max(1, maxLength - extension.length);
  const truncated = `${normalized.slice(0, stemLimit)}${extension}`.replace(/[. ]+$/, '');
  return truncated || fallback;
}

export function validateUploadedFile(
  file: Express.Multer.File,
  allowedKinds: readonly AllowedUploadKind[],
  maxBytes: number,
): ValidatedUpload {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new BadRequestException('Файл обязателен');
  }

  const sizeBytes = file.buffer.length;
  if (sizeBytes === 0) throw new BadRequestException('Файл пустой');
  if (sizeBytes > maxBytes) throw new BadRequestException(`Файл больше ${Math.floor(maxBytes / 1024 / 1024)} МБ`);

  const kind = detectKind(file.buffer);
  if (!kind || !allowedKinds.includes(kind)) {
    throw new BadRequestException('Тип файла не разрешён или содержимое повреждено');
  }

  const definition = UPLOAD_TYPES[kind];
  if (file.mimetype !== definition.mimeType) {
    throw new BadRequestException('MIME-тип файла не соответствует его содержимому');
  }

  const extension = originalExtension(file.originalname ?? '');
  if (extension && !definition.acceptedExtensions.includes(extension)) {
    throw new BadRequestException('Расширение файла не соответствует его содержимому');
  }

  return {
    kind,
    extension: definition.extension,
    mimeType: definition.mimeType,
    originalName: sanitizeOriginalFilename(file.originalname, definition.extension),
    sizeBytes,
  };
}

export function isCanonicalStoredPhotoPath(path: string): boolean {
  return STORED_PHOTO_PATH.test(path);
}

export function mimeTypeForStoredPath(path: string): string | null {
  const extension = extname(path).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.pdf') return 'application/pdf';
  return null;
}
