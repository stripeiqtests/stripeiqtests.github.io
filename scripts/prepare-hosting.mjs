import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function securityHeaders(html) {
  // The existing GitHub Pages redirect helper remains functional without
  // permitting arbitrary inline scripts. Hash exactly the emitted script text.
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes, source]) => !/\bsrc\s*=/i.test(attributes) && source.trim())
    .map(([, , source]) => `'sha256-${createHash('sha256').update(source).digest('base64')}'`);
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://afsoyuczexiztsjntkvi.supabase.co wss://afsoyuczexiztsjntkvi.supabase.co https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
  return `/*\n  Content-Security-Policy: ${csp}\n  Strict-Transport-Security: max-age=31536000\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\nhttps://:project.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.:project.pages.dev/*\n  X-Robots-Tag: noindex\n`;
}
export function prepareHosting(outputDirectory, cloudflare = false) {
  const html = readFileSync(resolve(outputDirectory, 'index.html'), 'utf8');
  writeFileSync(resolve(outputDirectory, '_headers'), securityHeaders(html));
  if (cloudflare) {
    // Cloudflare's documented SPA fallback requires no top-level 404.html.
    // GitHub Pages still needs the legacy redirect file, so retain it there.
    const fallback = resolve(outputDirectory, '404.html');
    if (existsSync(fallback)) unlinkSync(fallback);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareHosting(resolve(import.meta.dirname, '../dist'), process.env.CF_PAGES === '1');
  console.log(`Hosting headers prepared; ${process.env.CF_PAGES === '1' ? 'Cloudflare SPA fallback' : 'GitHub Pages redirect fallback'} retained.`);
}
