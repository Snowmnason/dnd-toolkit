/*
 * Web build hardening script
 * - Injects CSP nonce into compiled assets
 * - Adds Subresource Integrity (SRI) to bundled scripts/styles when possible
 * - Emits a strict _headers file with security and caching directives
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Handle __dirname for different Node.js contexts
const __filename = typeof __filename !== 'undefined' ? __filename : require('url').fileURLToPath(import.meta.url);
const __dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename);

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

function generateNonce() {
  return crypto.randomBytes(24).toString('base64');
}

function computeIntegrity(filePath) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

function addNonceToTags(html, nonce) {
  const scriptPatched = html.replace(/<script(?![^>]*\bnonce=)([^>]*)>/gi, (_match, attrs) => {
    return `<script nonce="${nonce}"${attrs}>`;
  });

  const stylePatched = scriptPatched.replace(/<style(?![^>]*\bnonce=)([^>]*)>/gi, (_match, attrs) => {
    return `<style nonce="${nonce}"${attrs}>`;
  });

  return stylePatched;
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

function buildCsp(nonce) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.supabase.co`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests'
  ];

  return directives.join('; ');
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
    '  Cross-Origin-Embedder-Policy: require-corp',
    '  Access-Control-Allow-Origin: https://dnd-tool.thesnowpost.com',
    '  Access-Control-Allow-Methods: GET, OPTIONS',
    '  Access-Control-Allow-Headers: Content-Type, Authorization',
    '*/',
    '',
    '/*.html',
    '  Cache-Control: public, max-age=300',
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
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  html = addNonceToTags(html, nonce);
  html = addSriAttributes(html);
  html = injectCspMeta(html, csp);

  fs.writeFileSync(INDEX_HTML, html, 'utf8');
  console.log('[harden-web] injected nonce and SRI into index.html');

  writeHeadersFile(csp);
}

harden();
