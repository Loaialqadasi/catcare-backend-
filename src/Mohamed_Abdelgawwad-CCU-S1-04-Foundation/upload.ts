import multer from 'multer';
import { uploadToStorage } from './supabase-storage.js';
import { ValidationError } from './errors.js';

export interface UploadResult {
  url: string;
  publicId: string | null;
}

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new ValidationError('Only JPG, PNG, or WEBP images are allowed', { field: 'photo' }));
  }
  cb(null, true);
};

// Memory storage — file never touches disk, streamed directly to Supabase Storage
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

/**
 * Validate the magic bytes (file signature) of an image buffer.
 * This prevents MIME-type spoofing where an attacker sets the Content-Type
 * header to an allowed image type but the actual file content is malicious.
 *
 * Supported signatures:
 *   JPEG: FF D8 FF
 *   PNG:  89 50 4E 47 0D 0A 1A 0A
 *   WebP: 52 49 46 46 (RIFF) and 57 45 42 50 (WEBP) at offset 8
 *
 * @param buffer - The file buffer to validate
 * @returns true if the buffer matches a known image signature
 */
export function validateMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // WebP: starts with RIFF (52 49 46 46) and has WEBP (57 45 42 50) at offset 8
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

/**
 * Upload an image buffer. Uses Supabase Storage if configured.
 * If Supabase is NOT configured (or upload fails), returns a base64 data URL
 * of the actual image so that the rest of the application still works.
 *
 * Before uploading, validates the file's magic bytes to ensure the content
 * matches an allowed image format (JPEG, PNG, or WebP). This prevents
 * MIME-type spoofing attacks where a malicious file is disguised with a
 * legitimate Content-Type header.
 */
export const uploadImage = async (
  buffer: Buffer,
  folder = 'catcare-utm'
): Promise<UploadResult> => {
  if (!validateMagicBytes(buffer)) {
    throw new ValidationError(
      'Invalid image file. Only real JPG, PNG, or WebP images are allowed.',
      { field: 'photo' }
    );
  }

  return uploadToStorage(buffer, folder);
};
