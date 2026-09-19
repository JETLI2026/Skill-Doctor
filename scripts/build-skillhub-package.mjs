import { resolve } from 'node:path';
import { buildSkillHubPackage } from '../dist/packaging/skillhub.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out' || !args[1]) throw new Error('用法：node scripts/build-skillhub-package.mjs --out <新目录>');
const output = resolve(args[1]);
const files = await buildSkillHubPackage(process.cwd(), output);
console.log(`已生成 SkillHub 发布包：${output}`);
for (const file of files) console.log(`- ${file}`);
