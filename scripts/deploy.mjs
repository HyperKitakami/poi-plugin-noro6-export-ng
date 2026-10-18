#!/usr/bin/env node
// 把当前工作副本部署到 poi 的「本地插件」目录。
//
// 为什么是 plugins-extra 而不是 plugins：
//   poi 的插件管理（安装 / 更新 / 卸载）全部通过 npm 在 `plugins/` 里执行，
//   npm 7+ 的 reify 会把不在 `plugins/package.json` dependencies 里的目录当作
//   extraneous **直接删掉**（poi 传的 `--no-prune` 在 npm 11 已是未知配置，被忽略）。
//   本插件不在 npm 上，永远进不了那份 dependencies，所以放在 plugins/node_modules
//   每次「更新任意插件」都会被清掉一次。
//   `plugins-extra/node_modules/` 是 poi 给本地 / 非 npm 插件预留的位置：
//   它的安装 / 卸载都不走 npm，且同名时优先级高于 plugins/。
//
// 部署是「整目录重建」：本插件没有运行依赖，清空后重拷可以避免旧版本残留文件。

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const pkg = require(join(ROOT, 'package.json'));
if (!pkg.name || !/^poi-plugin-/.test(pkg.name)) {
  console.error(`✗ package.json 的 name 必须以 poi-plugin- 开头（当前 ${pkg.name || '(空)'}）`);
  console.error('  poi 按这个前缀扫描插件目录，名字不对插件不会出现在面板里。');
  process.exit(1);
}

const APPDATA = process.env.APPDATA;
if (!APPDATA) {
  console.error('找不到 %APPDATA%，本脚本只适用于 Windows。');
  process.exit(1);
}

const DEST = join(APPDATA, 'poi', 'plugins-extra', 'node_modules', pkg.name);
const LEGACY = join(APPDATA, 'poi', 'plugins', 'node_modules', pkg.name);

// 运行必需：入口 + 样式 + 元信息（package.json 决定插件名 / 标题 / 启用状态）
const REQUIRED = [pkg.main || 'index.es', 'index.css', 'package.json'];
// 另外把 package.json 的 files 白名单里还存在的条目一起带上（未来加资源目录时不用改脚本）
const EXTRA = (pkg.files || []).filter((f) => !REQUIRED.includes(f));

const missing = REQUIRED.filter((f) => !existsSync(join(ROOT, f)));
if (missing.length) {
  console.error(`✗ 缺少必需文件：${missing.join(', ')}`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

const copied = [];
for (const f of [...REQUIRED, ...EXTRA]) {
  const src = join(ROOT, f);
  if (!existsSync(src)) continue;
  const stat = statSync(src);
  if (stat.isDirectory()) {
    console.warn(`  ⚠ 暂不支持目录，已跳过：${f}`);
    continue;
  }
  copyFileSync(src, join(DEST, f));
  copied.push({ file: f, size: stat.size });
}

// 守卫：部署结果必须能被 poi 直接 require
const entry = join(DEST, pkg.main || 'index.es');
if (!existsSync(entry)) {
  console.error(`✗ 部署后找不到入口 ${pkg.main || 'index.es'}`);
  process.exit(1);
}

let entryPkg;
try {
  entryPkg = require(join(DEST, 'package.json'));
} catch (err) {
  console.error(`✗ 部署后的 package.json 无法解析：${err.message}`);
  process.exit(1);
}
if (entryPkg.name !== pkg.name) {
  console.error('✗ 部署后的 package.json 与源文件不一致');
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`✓ 已部署到 ${DEST}`);
for (const { file, size } of copied) console.log(`  ${file}  ${kb(size)}`);
console.log(`  共 ${copied.length} 个文件 · ${readdirSync(DEST).length} 项`);

if (existsSync(LEGACY)) {
  console.warn(`  ⚠ ${LEGACY} 仍存在旧副本（同名时 plugins-extra 优先，但建议删掉以免混淆）`);
}
console.log('  → 需要完全重启 poi 才会重新加载插件');
