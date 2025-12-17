import { z } from 'zod';

export const usernameSchema = z.string().trim().min(1).max(64);
export const passwordSchema = z.string().min(1).max(256);

export const titleSchema = z.string().trim().min(1).max(200);

export const urlSchema = z.string().trim().min(1).max(2048);
export const descriptionSchema = z.string().trim().max(4000).default('');

export const tagsSchema = z.array(z.string().trim().min(1).max(64)).max(50).default([]);

export const importStrategySchema = z.enum(['flatten', 'skip', 'root']);
export const importHtmlSchema = z.string().min(1).max(10_000_000); // Max ~10MB

// JSON export/import validation schemas
const jsonBookmarkSchema = z.object({
  url: urlSchema,
  title: titleSchema,
  description: descriptionSchema,
  tags: tagsSchema,
  position: z.number().int().min(0),
});

const jsonGroupSchema = z.object({
  title: titleSchema,
  position: z.number().int().min(0),
  bookmarks: z.array(jsonBookmarkSchema),
});

const jsonFolderSchema = z.object({
  title: titleSchema,
  position: z.number().int().min(0),
  groups: z.array(jsonGroupSchema),
});

const jsonWorkspaceSchema = z.object({
  title: titleSchema,
  position: z.number().int().min(0),
  folders: z.array(jsonFolderSchema),
});

export const jsonExportSchema = z.object({
  version: z.number().int().min(1).max(1),
  exportedAt: z.string(),
  workspaces: z.array(jsonWorkspaceSchema),
});

export function parseOrThrow<T>(schema: z.ZodType<T, any, unknown>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Invalid input');
  return r.data;
}
