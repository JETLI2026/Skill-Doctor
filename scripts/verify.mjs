import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const commands = [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['--test', ...readdirSync('tests').filter(file => file.endsWith('.test.ts')).map(file => `tests/${file}`)],
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
];
for (const args of commands) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) { console.error(result.error.message); process.exit(2); }
  if (result.status !== 0) process.exit(result.status ?? 2);
}
