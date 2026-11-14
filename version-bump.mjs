// 同步版本号：node version-bump.mjs 1.2.1
// 同时更新 manifest.json / versions.json / package.json，避免三处漂移。
import { readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2];
if (!target || !/^\d+\.\d+\.\d+$/.test(target)) {
  console.error('用法: node version-bump.mjs <x.y.z>（严格三段数字，不带 v）');
  process.exit(1);
}

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + '\n');

const manifest = read('manifest.json');
const versions = read('versions.json');
const pkg = read('package.json');

const minAppVersion = versions[target] || manifest.minAppVersion;
manifest.version = target;
manifest.minAppVersion = minAppVersion;
versions[target] = minAppVersion;
pkg.version = target;

write('manifest.json', manifest);
write('versions.json', versions);
write('package.json', pkg);
console.log(`已升到 ${target}（minAppVersion ${minAppVersion}），请提交后再打同名 tag`);
