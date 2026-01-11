/*
 * Web build hardening script
 * - Injects CSP nonce into compiled assets
 * - Adds Subresource Integrity (SRI) to bundled scripts/styles when possible
 * - Emits a strict _headers file with security and caching directives
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '..', 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const HEADERS_FILE = path.join(DIST_DIR, '_headers');

function ensureDist() {
  if (!fs.existsSync(DIST_DIR)) {
    console.warn('[harden-web] dist folder missing; run "expo export -p web" first');
    return false;
  }
  if (!fs.existsSync(INDEX_HTML)) {
    console.warn('[harden-web] index.html missing in dist; skipping hardening');
    return false;
  }
  return true;
}

// Compute CSP-safe hashes for inline content
function computeCspHash(content) {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
  return `sha256-${hash}`;
}

function computeIntegrity(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

// Extract inline <script> and <style> contents to build hash-based CSP
function extractInlineContents(html) {
  const scriptMatches = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi));
  const styleMatches = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));

  const scriptContents = scriptMatches.map(m => (m[1] || '').trim()).filter(Boolean);
  const styleContents = styleMatches.map(m => (m[1] || '').trim()).filter(Boolean);

  const scriptHashes = scriptContents.map(computeCspHash).map(hash => `'${hash}'`);
  const styleHashes = styleContents.map(computeCspHash).map(hash => `'${hash}'`);

  return { scriptHashes, styleHashes };
}

function addSriAttributes(html) {
  const scriptRegex = /<script([^>]*)src="([^"]+)"([^>]*)><\/script>/gi;
  return html.replace(scriptRegex, (full, preAttrs, src, postAttrs) => {
    if (/^https?:\/\//i.test(src)) {
      // External scripts are not rewritten here; they should already be vetted.
      return full;
    }

    const normalizedSrc = src.replace(/^\//, '');
    const assetPath = path.join(DIST_DIR, normalizedSrc);

    if (!fs.existsSync(assetPath)) {
      console.warn('[harden-web] unable to find asset for SRI:', src);
      return full;
    }

    const integrity = computeIntegrity(assetPath);
    const hasIntegrity = /\bintegrity=/.test(full);
    const hasCrossOrigin = /\bcrossorigin=/.test(full);
    const crossOriginAttr = hasCrossOrigin ? '' : ' crossorigin="anonymous"';

    if (hasIntegrity) {
      return full;
    }

    return `<script${preAttrs}src="${src}" integrity="${integrity}"${crossOriginAttr}${postAttrs}></script>`;
  });
}

function buildCsp(scriptHashes, styleHashes) {
  const scriptSrc = [
    "'self'",
    'https://dnd-tool.thesnowpost.com',
    'https://*.supabase.co',
    "'strict-dynamic'", // ✅ Modern dynamic script loading (Expo code splitting)
    ...scriptHashes,
    "'unsafe-inline'" // ✅ Fallback for old browsers (ignored with strict-dynamic)
  ].join(' ');

  const styleSrc = [
    "'self'",
    'https://fonts.googleapis.com',
    "'unsafe-inline'",  // Allow inline styles that can't be hashed (React Native Web runtime styles)
    ...styleHashes,
  ].join(' ');

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https://fonts.gstatic.com', // ✅ Tightened from https:
    'https://*.supabase.co',
    'https://dnd-tool.thesnowpost.com'
  ].join(' ');

  const connectSrc = [
    "'self'",
    'https://dnd-tool.thesnowpost.com', // ✅ Added for API calls
    'https://*.supabase.co',
    'wss://*.supabase.co'
  ].join(' ');

  // Note: frame-ancestors MUST be in HTTP headers only, not meta tags
  // It will be ignored if placed in a meta CSP tag
  const metaDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com",
    `img-src ${imgSrc}`, // ✅ Tightened to specific domains
    `connect-src ${connectSrc}`, // ✅ Added domain
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests'
  ];

  // Full directives for HTTP headers (includes frame-ancestors)
  const headerDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests'
  ];

  return {
    meta: metaDirectives.join('; '),
    header: headerDirectives.join('; ')
  };
}

function injectCspMeta(html, csp) {
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  if (/http-equiv="Content-Security-Policy"/i.test(html)) {
    return html.replace(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/i, metaTag);
  }
  return html.replace(/<head>/i, `<head>\n  ${metaTag}`);
}

function writeHeadersFile(csp) {
  const headerLines = [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    '  X-Frame-Options: DENY',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '  Cross-Origin-Resource-Policy: same-origin',
    '  Cross-Origin-Embedder-Policy: credentialless',
    '*/',
    '',
    '/*.html',
    '  Cache-Control: public, max-age=86400',
    '',
    '/*.js',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/*.css',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    ''
  ];

  fs.writeFileSync(HEADERS_FILE, headerLines.join('\n'), 'utf8');
  console.log('[harden-web] wrote security headers to', HEADERS_FILE);
}

function harden() {
  if (!ensureDist()) {
    return;
  }

  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  const { scriptHashes, styleHashes } = extractInlineContents(html);
  const cspPolicies = buildCsp(scriptHashes, styleHashes);

  html = addSriAttributes(html);
  html = injectCspMeta(html, cspPolicies.meta);

  fs.writeFileSync(INDEX_HTML, html, 'utf8');
  console.log('[harden-web] injected SRI and hash-based CSP into index.html');

  writeHeadersFile(cspPolicies.header);
}

harden();
