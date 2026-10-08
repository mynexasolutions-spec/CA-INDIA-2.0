import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cssBeforeScripts()],
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
