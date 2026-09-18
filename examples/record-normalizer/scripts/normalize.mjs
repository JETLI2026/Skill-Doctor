import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function normalizeRecord(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return { error: 'INVALID_INPUT' };
  if (typeof input.sku !== 'string' || input.sku.trim().length < 1 || input.sku.trim().length > 100) return { error: 'INVALID_SKU' };
  const quantity = Object.hasOwn(input, 'quantity') ? input.quantity : 1;
  if (!Number.isSafeInteger(quantity) || quantity < 0) return { error: 'INVALID_QUANTITY' };
  return { sku: input.sku.trim(), quantity };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  try { process.stdout.write(`${JSON.stringify(normalizeRecord(JSON.parse(text)))}\n`); }
  catch { process.stdout.write('{"error":"INVALID_JSON"}\n'); process.exitCode = 1; }
}
