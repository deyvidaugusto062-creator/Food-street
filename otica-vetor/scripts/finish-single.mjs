/** Renomeia os HTMLs de arquivo único gerados por `npm run build:single`. */
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist-single', { recursive: true });
await copyFile('dist-single/single.html', 'dist-single/otica-vetor.html');
await copyFile('dist-single-revisao/single.html', 'dist-single/otica-vetor-revisao.html');
console.log('✓ dist-single/otica-vetor.html e dist-single/otica-vetor-revisao.html');
