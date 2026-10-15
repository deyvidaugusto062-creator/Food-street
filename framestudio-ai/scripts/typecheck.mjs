// Checa os tipos de todos os pacotes, do app web e dos testes E2E.
import { execFileSync } from 'node:child_process';
const projects = [
  'packages/shared', 'packages/timeline', 'packages/editor-core', 'packages/media-engine', 'packages/audio-engine',
  'packages/render-engine', 'packages/ai-engine', 'packages/project-storage', 'packages/ui', 'apps/web',
];
let failed = false;
for (const p of projects) {
  try {
    execFileSync('npx', ['tsc', '--noEmit', '-p', `${p}/tsconfig.json`], { stdio: 'inherit' });
    console.log(`✓ ${p}`);
  } catch {
    failed = true;
    console.log(`✗ ${p}`);
  }
}
try {
  execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.e2e.json'], { stdio: 'inherit' });
  console.log('✓ e2e');
} catch {
  failed = true;
}
process.exit(failed ? 1 : 0);
