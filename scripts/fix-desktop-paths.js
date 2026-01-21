#!/usr/bin/env node

/**
 * Fix absolute paths to relative paths in HTML files for Electron
 * This allows the app to load resources when using file:// protocol
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = path.join(__dirname, "..", "dist");

// Recursively find files by extension
function findFilesByExtension(dir, extension) {
  const matches = [];

  try {
    const files = readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        matches.push(...findFilesByExtension(filePath, extension));
      } else if (file.endsWith(extension)) {
        matches.push(filePath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return matches;
}

const htmlFiles = findFilesByExtension(distDir, ".html");

console.log(`[Fix Desktop Paths] Found ${htmlFiles.length} HTML files`);

// Also find and fix JS bundles
const jsFiles = findFilesByExtension(distDir, ".js");

console.log(`[Fix Desktop Paths] Found ${jsFiles.length} JS files`);

// Also find and fix CSS files (for font paths)
const cssFiles = findFilesByExtension(distDir, ".css");

console.log(`[Fix Desktop Paths] Found ${cssFiles.length} CSS files`);

// ============================================================================
// Inject fonts into index.html at build time
// ============================================================================
// This eliminates the need for runtime file I/O in the Electron main process,
// reducing startup time by ~10-50ms. Fonts are injected once during the build
// and available immediately when the app loads.

const indexHtmlPath = path.join(distDir, "index.html");

try {
  const indexStat = statSync(indexHtmlPath);
  if (indexStat) {
    let indexContent = readFileSync(indexHtmlPath, "utf8");

    // Skip if fonts already injected (marked by detection comment)
    if (!indexContent.includes("<!-- DESKTOP_FONTS_INJECTED -->")) {
      // Try to read fonts.css from the root dist directory
      const fontsCssPath = path.join(distDir, "fonts.css");
      let fontsCss = "";

      try {
        const fontsStat = statSync(fontsCssPath);
        if (fontsStat) {
          fontsCss = readFileSync(fontsCssPath, "utf8");
          // Replace relative paths with app:// protocol paths
          // /FontName.ttf becomes app://FontName.ttf
          fontsCss = fontsCss.replace(/url\('\/([^']+)'\)/g, "url('app://$1')");
          console.log(
            "[Fix Desktop Paths] ✓ Injected fonts.css into index.html",
          );
        }
      } catch {
        // Fallback: create inline @font-face for known fonts
        console.log(
          "[Fix Desktop Paths] ⚠️ fonts.css not found, using fallback fonts",
        );
        fontsCss = `@font-face{font-family:'GrenzeGotisch';src:url('app://GrenzeGotisch.ttf') format('truetype');font-display:swap}@font-face{font-family:'Eurostile';src:url('app://Eurostile.ttf') format('truetype');font-display:swap}@font-face{font-family:'Cyberpunk';src:url('app://Cyberpunk.ttf') format('truetype');font-display:swap}`;
      }

      // Inject inline <style> with detection marker
      const fontsStyleTag = `<!-- DESKTOP_FONTS_INJECTED --><style>${fontsCss}</style>`;
      indexContent = indexContent.replace(
        /<head[^>]*>/i,
        `<head>${fontsStyleTag}`,
      );

      writeFileSync(indexHtmlPath, indexContent, "utf8");
      console.log("[Fix Desktop Paths] ✓ Font injection complete");
    } else {
      console.log("[Fix Desktop Paths] ℹ️ Fonts already injected, skipping");
    }
  }
} catch (error) {
  console.error("[Fix Desktop Paths] ✗ Error injecting fonts:", error.message);
}

// Fix HTML files
htmlFiles.forEach((filePath) => {
  try {
    let content = readFileSync(filePath, "utf8");
    const originalContent = content;

    // Replace absolute paths with app:// protocol paths for Electron
    // /_expo/static -> app://_expo/static
    content = content.replace(/href="\/_expo\//g, 'href="app://_expo/');
    content = content.replace(/src="\/_expo\//g, 'src="app://_expo/');

    // /assets -> app://assets
    content = content.replace(/href="\/assets\//g, 'href="app://assets/');
    content = content.replace(/src="\/assets\//g, 'src="app://assets/');

    // /favicon -> app://favicon
    content = content.replace(/href="\/favicon/g, 'href="app://favicon');
    content = content.replace(/src="\/favicon/g, 'src="app://favicon');

    // Remove integrity attributes since we're modifying paths
    // SRI hashes are incompatible with Electron's custom protocol
    content = content.replace(/\s+integrity="[^"]*"/g, "");
    content = content.replace(/\s+crossorigin="anonymous"/g, "");

    if (content !== originalContent) {
      writeFileSync(filePath, content, "utf8");
      console.log(`✓ Fixed: ${path.relative(distDir, filePath)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
});

// Fix JS bundles - replace absolute paths in JavaScript code
jsFiles.forEach((filePath) => {
  try {
    let content = readFileSync(filePath, "utf8");
    const originalContent = content;

    // Replace absolute paths in JS strings with app:// protocol
    // Match patterns like "/_expo/static" in string literals
    content = content.replace(/"\/_expo\//g, '"app://_expo/');
    content = content.replace(/'\/_expo\//g, "'app://_expo/");
    content = content.replace(/`\/_expo\//g, "`app://_expo/");

    // Match /assets/ paths
    content = content.replace(/"\/assets\//g, '"app://assets/');
    content = content.replace(/'\/assets\//g, "'app://assets/");
    content = content.replace(/`\/assets\//g, "`app://assets/");

    if (content !== originalContent) {
      writeFileSync(filePath, content, "utf8");
      console.log(`✓ Fixed JS: ${path.relative(distDir, filePath)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing JS ${filePath}:`, error.message);
  }
});

// Fix CSS files - replace absolute paths in url() declarations (for fonts)
cssFiles.forEach((filePath) => {
  try {
    let content = readFileSync(filePath, "utf8");
    const originalContent = content;

    // CSS url() declarations need special handling for the app:// protocol
    // The regex matches url() with optional quotes and replaces /fonts/* paths
    // Example: url('/fonts.ttf') -> url('app://fonts.ttf')
    // This ensures font files and other CSS assets load correctly from the bundled resources
    content = content.replace(
      /url\((['"])?\/([^)'"]*)(['"])?\)/g,
      "url($1app://$2$3)",
    );

    if (content !== originalContent) {
      writeFileSync(filePath, content, "utf8");
      console.log(`✓ Fixed CSS: ${path.relative(distDir, filePath)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing CSS ${filePath}:`, error.message);
  }
});

console.log("[Fix Desktop Paths] Done!");
