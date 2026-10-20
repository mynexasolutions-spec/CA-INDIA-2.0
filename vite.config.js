import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Vite's default build emits the entry <script type="module"> BEFORE its own
// <link rel="stylesheet">, since the CSS is only discovered transitively (imported
// from main.jsx, not referenced in source index.html). Module scripts aren't
// guaranteed to block on a stylesheet that appears after them in the document, so on
// a slow connection the app can mount and paint fully unstyled for several seconds
// before the CSS finishes downloading (flash of unstyled content on first login).
// This plugin reorders the built index.html so every stylesheet <link> comes right
// after <head>, ahead of all scripts — the browser then blocks script execution
// until CSS is ready, the same ordering most frameworks emit by default.
function cssBeforeScripts() {
  return {
    name: 'css-before-scripts',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*>\s*/g;
        const links = html.match(linkRe);
        if (!links) return html;
        const stripped = html.replace(linkRe, '');
        // Insert right after <meta charset>, which must stay the very first element in
        // <head> per spec — not right after <head> itself.
        return stripped.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${links.join('    ')}`);
      },
    },
  };
}

// Copies the pdfjs worker file into the build output so it can be
// referenced as a static URL (/pdf.worker.min.mjs) without using the
// ?url import syntax that Rolldown (Vite 6) cannot resolve from node_modules.
function pdfWorkerPlugin() {
  const workerPath = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  return {
    name: 'pdf-worker-copy',
    // The dev server has no build step, so serve the same file at the same URL while developing.
    configureServer(server) {
      server.middlewares.use('/pdf.worker.min.mjs', (_req, res, next) => {
        if (!fs.existsSync(workerPath)) return next();
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(fs.readFileSync(workerPath));
      });
    },
    generateBundle() {
      if (fs.existsSync(workerPath)) {
        this.emitFile({
          type: 'asset',
          fileName: 'pdf.worker.min.mjs',
          source: fs.readFileSync(workerPath, 'utf8'),
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cssBeforeScripts(), pdfWorkerPlugin()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/storage': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
