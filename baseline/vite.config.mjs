import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');

const platform = 'baseline';
let resolvedConfig;

export default defineConfig({
  plugins: [
    react({ jsxImportSource: 'react' }),
    {
      name: 'bundle-evidence',
      /** Retain effective configuration for the build evidence. */
      configResolved(config) {
        resolvedConfig = config;
      },
      /** Record actual module graph and rendered contributions without changing output. */
      generateBundle(_options, bundle) {
        const modules = [...this.getModuleIds()].map(id => ({
          id,
          importedIds: this.getModuleInfo(id).importedIds,
          isIncluded: this.getModuleInfo(id).isIncluded,
        }));
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => ({
          fileName: chunk.fileName,
          modules: Object.fromEntries(Object.entries(chunk.modules).map(([id, module]) => [id, { renderedLength: module.renderedLength, originalLength: module.originalLength, renderedExports: module.renderedExports, removedExports: module.removedExports }])),
        }));
        mkdirSync('../evidence', { recursive: true });
        writeFileSync(`../evidence/${platform}.json`, JSON.stringify({
          platform,
          inputs: Object.fromEntries(['src/main.tsx', 'package.json', 'pnpm-lock.yaml', 'vite.config.mjs', 'tsconfig.json'].map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')])),
          mode: resolvedConfig.mode,
          base: resolvedConfig.base,
          build: resolvedConfig.build,
          aliases: resolvedConfig.resolve.alias.map(alias => ({ find: String(alias.find), replacement: alias.replacement })),
          modules,
          chunks,
        }, null, 2).split(repositoryRoot).join('<repo>'));
      },
    },
  ],
  // Use the same React deduplication policy as both SDK builds.
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { minify: 'esbuild', sourcemap: true },
});
