import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const distClientDir = path.join(root, 'dist', 'client');
const distAssetsDir = path.join(distClientDir, 'assets');

const CLIS = {
  tailwindcss: path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
  esbuild: path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild')
};

const node = process.execPath;

await fs.mkdir(distAssetsDir, { recursive: true });
await fs.copyFile(path.join(root, 'src', 'client', 'index.html'), path.join(distClientDir, 'index.html'));

const tailwind = spawn(node, [
  CLIS.tailwindcss,
  '-c',
  'tailwind.config.cjs',
  '-i',
  'src/client/styles.css',
  '-o',
  'dist/client/assets/app.css',
  '--postcss',
  '--watch'
], { stdio: 'inherit' });

const esbuild = spawn(node, [
  CLIS.esbuild,
  'src/client/main.ts',
  '--bundle',
  '--format=esm',
  '--target=es2022',
  '--outfile=dist/client/assets/app.js',
  '--sourcemap',
  '--watch'
], { stdio: 'inherit' });

function shutdown(code = 0) {
  try {
    tailwind.kill();
  } catch {}
  try {
    esbuild.kill();
  } catch {}
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

tailwind.on('exit', (code) => {
  if (typeof code === 'number' && code !== 0) shutdown(code);
});

esbuild.on('exit', (code) => {
  if (typeof code === 'number' && code !== 0) shutdown(code);
});
