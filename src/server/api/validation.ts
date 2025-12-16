import { z } from 'zod';

export const usernameSchema = z.string().trim().min(1).max(64);
export const passwordSchema = z.string().min(1).max(256);

export const titleSchema = z.string().trim().min(1).max(200);

export const urlSchema = z.string().trim().min(1).max(2048);
export const descriptionSchema = z.string().trim().max(4000).default('');

export const tagsSchema = z.array(z.string().trim().min(1).max(64)).max(50).default([]);

export function parseOrThrow<T>(schema: z.ZodType<T, any, unknown>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? 'Invalid input');
  return r.data;
}
