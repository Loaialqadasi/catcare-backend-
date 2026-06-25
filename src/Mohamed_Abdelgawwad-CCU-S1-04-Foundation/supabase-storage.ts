import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { logger } from './logger.js';

let supabase: SupabaseClient | null = null;

/**
 * Initialize the Supabase client.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 */
function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return supabase;
  }

  return null;
}

/**
 * Auto-create the storage bucket if it doesn't exist.
 * This runs on server startup so uploads don't fail silently.
 */
export async function ensureBucketExists(): Promise<void> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured — skipping bucket check');
    return;
  }

  const client = getSupabase();
  if (!client) return;

  const bucketName = env.SUPABASE_BUCKET || 'uploads';

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await client.storage.listBuckets();

    if (listError) {
      logger.error({ err: listError }, 'Failed to list Supabase storage buckets');
      return;
    }

    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (!bucketExists) {
      logger.info({ bucketName }, 'Creating Supabase storage bucket...');
      const { error: createError } = await client.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });

      if (createError) {
        logger.error({ err: createError, bucketName }, 'Failed to create Supabase storage bucket');
        return;
      }

      logger.info({ bucketName }, 'Supabase storage bucket created successfully');
    } else {
      logger.info({ bucketName }, 'Supabase storage bucket already exists');

      // Make sure the bucket is public
      const bucket = buckets.find(b => b.name === bucketName);
      if (bucket && !bucket.public) {
        logger.info({ bucketName }, 'Making bucket public...');
        const { error: updateError } = await client.storage.updateBucket(bucketName, {
          public: true,
        });
        if (updateError) {
          logger.error({ err: updateError, bucketName }, 'Failed to make bucket public');
        } else {
          logger.info({ bucketName }, 'Bucket is now public');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Unexpected error checking/creating Supabase bucket');
  }
}

/**
 * Diagnostic: Check Supabase Storage connectivity and bucket status.
 * Returns a detailed status object for the health endpoint.
 */
export async function getStorageStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  bucketExists: boolean;
  bucketPublic: boolean;
  error?: string;
}> {
  const result = {
    configured: isSupabaseConfigured(),
    connected: false,
    bucketExists: false,
    bucketPublic: false,
    error: undefined as string | undefined,
  };

  if (!isSupabaseConfigured()) {
    result.error = 'SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set';
    return result;
  }

  const client = getSupabase();
  if (!client) {
    result.error = 'Failed to initialize Supabase client';
    return result;
  }

  try {
    const { data: buckets, error: listError } = await client.storage.listBuckets();

    if (listError) {
      result.error = `List buckets failed: ${listError.message}`;
      return result;
    }

    result.connected = true;

    const bucketName = env.SUPABASE_BUCKET || 'uploads';
    const bucket = buckets?.find(b => b.name === bucketName);

    if (bucket) {
      result.bucketExists = true;
      result.bucketPublic = bucket.public;
    } else {
      result.error = `Bucket '${bucketName}' does not exist`;
    }
  } catch (err) {
    result.error = `Connection failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return result;
}

/** Returns true if Supabase credentials are configured. */
export const isSupabaseConfigured = (): boolean =>
  !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * Falls back to base64 data URL if Supabase is not configured or upload fails.
 */
export async function uploadToStorage(
  buffer: Buffer,
  folder = 'catcare-utm',
  customFileName?: string,
): Promise<{ url: string; publicId: string | null }> {
  // Try Supabase upload first
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabase();
      if (!client) throw new Error('Supabase client not initialized');

      // Detect MIME type from magic bytes
      let mimeType = 'image/png';
      let ext = 'png';
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        mimeType = 'image/jpeg';
        ext = 'jpg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        mimeType = 'image/png';
        ext = 'png';
      } else if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      ) {
        mimeType = 'image/webp';
        ext = 'webp';
      }

      // Generate unique file name
      const crypto = await import('node:crypto');
      const uniqueId = crypto.randomBytes(16).toString('hex');
      const fileName = customFileName || `${uniqueId}.${ext}`;
      const filePath = `${folder}/${fileName}`;

      // Ensure the bucket name is set (default: 'uploads')
      const bucketName = env.SUPABASE_BUCKET || 'uploads';

      // Upload to Supabase Storage
      const { error: uploadError } = await client.storage
        .from(bucketName)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Supabase upload failed: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: urlData } = client.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        logger.info({ filePath, publicUrl: urlData.publicUrl, bufferSize: buffer.length }, 'File uploaded to Supabase Storage successfully');
        return {
          url: urlData.publicUrl,
          publicId: filePath,
        };
      }

      throw new Error('Failed to get public URL from Supabase');
    } catch (err) {
      logger.error(
        { err, folder, bufferSize: buffer.length },
        'Supabase upload failed, falling back to base64 data URL'
      );
      // Fall through to base64 fallback
    }
  }

  // Fallback: convert the image to a base64 data URL
  try {
    let mimeType = 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      mimeType = 'image/webp';
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      url: dataUrl,
      publicId: null,
    };
  } catch {
    // Last resort: generate a lightweight placeholder SVG data URL
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect fill="#f59e0b" width="400" height="300"/>
      <text fill="#fff" font-family="sans-serif" font-size="18" x="50%" y="50%" text-anchor="middle" dy=".3em">Photo uploaded (placeholder)</text>
    </svg>`;
    const b64 = Buffer.from(placeholderSvg).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${b64}`;

    return {
      url: dataUrl,
      publicId: null,
    };
  }
}

/**
 * Delete a file from Supabase Storage by its publicId (file path).
 */
export async function deleteFromStorage(publicId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const client = getSupabase();
    if (!client) return false;

    const bucketName = env.SUPABASE_BUCKET || 'uploads';
    const { error } = await client.storage
      .from(bucketName)
      .remove([publicId]);

    if (error) {
      console.warn('Supabase delete failed:', error.message);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
