import { z } from 'zod';
import { readFile } from 'node:fs/promises';
export const configSchema = z.object({
  maxLines: z.number().int().positive().default(500),
  maxTokens: z.number().int().positive().default(5000),
  maxSectionTokens: z.number().int().positive().default(1200),
  maxRules: z.number().int().positive().default(50),
  maxConditions: z.number().int().positive().default(20),
  maxProhibitions: z.number().int().positive().default(20),
  minDuplicateChars: z.number().int().positive().default(24),
  maxFileBytes: z.number().int().positive().default(1024 * 1024),
  maxTotalBytes: z.number().int().positive().default(10 * 1024 * 1024),
  maxFiles: z.number().int().positive().default(1000),
  maxSemanticChars: z.number().int().positive().default(120000),
  ignore: z.array(z.string().min(1)).default(['.git', 'node_modules', '.skill-doctor', 'dist', '.env']),
  disabledRules: z.array(z.string()).default([]),
}).strict();
export type Config = z.infer<typeof configSchema>;
export const defaultConfig: Config = configSchema.parse({});
export async function loadConfig(file?: string): Promise<Config> {
  return configSchema.parse(file ? JSON.parse(await readFile(file, 'utf8')) : {});
}
