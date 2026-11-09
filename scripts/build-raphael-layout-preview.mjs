import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = path.join(root, 'admin/raphael-preview');
const read = (name) => readFile(path.join(root, name), 'utf8');
const [sourceHtml, sourceCss, sourceJs, rig] = await Promise.all([
  read('admin/index.html'), read('admin/admin.css'), read('admin/admin.js'),
  read('admin/raphael-preview/raphael.svg')
]);
function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Snapshot source changed: ${label}`);
  return source.replace(pattern, replacement);
}
let html = replaceRequired(sourceHtml, /<div class="hero-stamp"[\s\S]*?<\/div>/,
  `<div class="raphael-slot" aria-hidden="true"><div class="raphael-aura"></div><div class="raphael-mascot">${rig.trim()}</div></div>`, 'hero stamp');
html = replaceRequired(html, /<link rel="stylesheet" href="\.\/admin.css[^\"]*">/,
  '<link rel="stylesheet" href="./directory.css">\n  <link rel="stylesheet" href="./mascot.css">\n  <link rel="preload" as="image" href="./assets/raphael-grand-wings-v4.webp">', 'stylesheet');
html = replaceRequired(html, /\s*<script src="\.\.\/assets\/site-content.js[^\"]*" defer><\/script>/, '', 'dynamic settings');
html = replaceRequired(html, /<script src="\.\/admin.js[^\"]*" defer><\/script>/,
  '<script src="./directory.js" defer></script>\n  <script src="./mascot.js" defer></script>', 'directory script');
html = html.replace(/href="(\.\/[^\"]*)"/g, (match, href) => {
  if (/^\.\/(?:directory\.css|mascot\.css|assets\/)/.test(href)) return match;
  return `href="${new URL(href, 'https://hua-urban.com/admin/').href}"`;
});
// This is a public static snapshot: no spreadsheet/config requests or backend calls.
let js = replaceRequired(sourceJs, /\/\/ Public display settings[\s\S]*$/, '', 'dynamic settings hook');
js = js.replace(/href:\s*"(\.\/[^\"]*)"/g, (_, href) => `href: "${new URL(href, 'https://hua-urban.com/admin/').href}"`);
html = html.replace(/connect-src [^;]+;/, "connect-src 'none';");
const assetVersion = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const [mascotCss, mascotJs] = await Promise.all([
  read('admin/raphael-preview/mascot.css'), read('admin/raphael-preview/mascot.js')
]);
for (const [file, content] of [['directory.css', sourceCss], ['mascot.css', mascotCss], ['directory.js', js], ['mascot.js', mascotJs]]) {
  html = html.replace(`./${file}\"`, `./${file}?v=${assetVersion(content)}\"`);
}
await writeFile(path.join(preview, 'index.html'), html.trimEnd() + '\n');
await writeFile(path.join(preview, 'directory.css'), sourceCss);
await writeFile(path.join(preview, 'directory.js'), js);
console.log('Built standalone public directory snapshot with Raphael hero slot.');
