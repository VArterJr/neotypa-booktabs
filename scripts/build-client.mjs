import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const distClientDir = path.join(root, 'dist', 'client');
const distAssetsDir = path.join(distClientDir, 'assets');

const CLIS = {
  tsc: path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  tailwindcss: path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
  esbuild: path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild')
};

await fs.rm(distClientDir, { recursive: true, force: true });
await fs.mkdir(distAssetsDir, { recursive: true });

await fs.copyFile(path.join(root, 'src', 'client', 'index.html'), path.join(distClientDir, 'index.html'));

await run(process.execPath, [CLIS.tsc, '-p', 'src/client/tsconfig.json', '--noEmit']);

await run(process.execPath, [
  CLIS.tailwindcss,
  '-c',
  'tailwind.config.cjs',
  '-i',
  'src/client/styles.css',
  '-o',
  'dist/client/assets/app.css',
  '--postcss',
  '--minify'
]);

await run(process.execPath, [
  CLIS.esbuild,
  'src/client/main.ts',
  '--bundle',
  '--format=esm',
  '--target=es2022',
  '--outfile=dist/client/assets/app.js',
  '--minify'
]);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}
