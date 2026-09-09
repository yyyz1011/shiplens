import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../../packages/cli/package.json', import.meta.url)));
export default defineConfig({
  base: process.env.DOCS_BASE || '/',
  define: { __SHIPLENS_VERSION__: JSON.stringify(process.env.DOCS_VERSION || pkg.version) },
});
