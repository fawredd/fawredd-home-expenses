/**
 * File system utilities for document storage
 */
import { promises as fs } from "fs";
import { join, extname, isAbsolute, normalize, relative, sep } from "path";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage/documents";
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

// Magic bytes for file validation
const MAGIC_BYTES: Record<string, Buffer> = {
  pdf: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  jpg: Buffer.from([0xff, 0xd8, 0xff]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
};

/**
 * Validate file magic bytes (actual file type, not just extension)
 */
export async function validateMagicBytes(buffer: Buffer): Promise<boolean> {
  // Check PDF
  if (buffer.slice(0, 4).equals(MAGIC_BYTES.pdf)) return true;

  // Check JPEG
  if (buffer.slice(0, 3).equals(MAGIC_BYTES.jpg)) return true;

  // Check PNG
  if (buffer.slice(0, 4).equals(MAGIC_BYTES.png)) return true;

  return false;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  filename = filename.replace(/\.\.\//g, "").replace(/\.\.\\/g, "");

  // Remove special characters, keep only alphanumeric, dots, hyphens, underscores
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, "");

  return filename;
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFilename(originalFilename: string): string {
  const ext = extname(originalFilename);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomId}${ext}`;
}

/**
 * Get year-month subdirectory path
 */
export function getDateSubdirectory(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return join(year.toString(), month);
}

function resolveStoragePath(filePath: string): string {
  if (isAbsolute(filePath)) return filePath;

  const normalizedStoragePath = normalize(`${STORAGE_PATH}${sep}`);
  const normalizedFilePath = normalize(filePath);

  if (normalizedFilePath.startsWith(normalizedStoragePath)) {
    return filePath;
  }

  return join(STORAGE_PATH, filePath);
}

/**
 * Save uploaded file to filesystem
 */
export async function saveFile(
  fileBuffer: Buffer,
  originalFilename: string,
): Promise<string> {
  // Generate unique filename
  const uniqueFilename = generateUniqueFilename(originalFilename);

  // Get date-based subdirectory
  const dateDir = getDateSubdirectory();

  // Create full file path
  const dirPath = join(STORAGE_PATH, dateDir);
  const fullPath = join(dirPath, uniqueFilename);

  // Ensure directory exists
  await fs.mkdir(dirPath, { recursive: true });

  // Write file to disk
  await fs.writeFile(fullPath, fileBuffer);

  // Store a relative path so retrieval uses STORAGE_PATH consistently
  return normalize(relative(STORAGE_PATH, fullPath));
}

/**
 * Get file from filesystem
 */
export async function getFile(filePath: string): Promise<Buffer> {
  const fullPath = resolveStoragePath(filePath);
  return fs.readFile(fullPath);
}

/**
 * Delete file from filesystem
 */
export async function deleteFile(filePath: string): Promise<void> {
  const fullPath = resolveStoragePath(filePath);
  await fs.unlink(fullPath);
}

/**
 * Validate uploaded file
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de archivo no permitido: ${file.type}. Solo PDF, JPG, PNG`,
    };
  }

  // Check extension
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Extensión no permitida: ${ext}`,
    };
  }

  // Check file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `Archivo demasiado grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (máx 5MB)`,
    };
  }

  return { valid: true };
}

export { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, STORAGE_PATH };
