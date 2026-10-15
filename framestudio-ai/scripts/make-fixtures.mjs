// Gera mídias de teste pequenas e reproduzíveis com FFmpeg (necessário no PATH).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');
mkdirSync(out, { recursive: true });
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// Vídeo A: 4 s, 640×360, 30 fps, VP9 + Opus (tom de 440 Hz).
ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4',
  '-c:v', 'libvpx-vp9', '-b:v', '600k', '-deadline', 'realtime', '-cpu-used', '8', '-g', '30', '-c:a', 'libopus', '-b:a', '96k', '-ac', '2', '-shortest', join(out, 'clip-a.webm'));

// Vídeo B: 3 s, barras SMPTE, VP9 + Opus com trechos de silêncio (fala simulada).
ff('-f', 'lavfi', '-i', 'smptebars=size=640x360:rate=30:duration=3',
  '-f', 'lavfi', '-i', "aevalsrc='if(lt(mod(t,1.5),0.6),0.5*sin(2*PI*660*t),0)':s=48000:d=3",
  '-c:v', 'libvpx-vp9', '-b:v', '500k', '-deadline', 'realtime', '-cpu-used', '8', '-g', '30', '-c:a', 'libopus', '-b:a', '96k', '-ac', '2', '-shortest', join(out, 'clip-b.webm'));

// Vídeo vertical 9:16 sem áudio.
ff('-f', 'lavfi', '-i', 'testsrc=size=360x640:rate=30:duration=2', '-c:v', 'libvpx-vp9', '-b:v', '300k', '-deadline', 'realtime', '-cpu-used', '8', join(out, 'vertical.webm'));

// Música: 6 s, acorde em WAV PCM 48 kHz estéreo.
ff('-f', 'lavfi', '-i', "aevalsrc='0.2*sin(2*PI*261.6*t)+0.2*sin(2*PI*329.6*t)+0.2*sin(2*PI*392*t)':s=48000:d=6", '-ac', '2', '-c:a', 'pcm_s16le', join(out, 'music.wav'));

// Narração com silêncios: 0–1 s fala, 1–2.5 s silêncio, 2.5–3.5 fala, 3.5–5 silêncio, 5–6 fala.
ff('-f', 'lavfi', '-i', "aevalsrc='if(lt(t,1)+between(t,2.5,3.5)+gt(t,5),0.4*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*3*t)),0.0005*sin(2*PI*50*t))':s=48000:d=6", '-ac', '1', '-c:a', 'pcm_s16le', join(out, 'speech.wav'));

// Foto PNG 800×600.
ff('-f', 'lavfi', '-i', 'testsrc2=size=800x600:duration=1', '-frames:v', '1', join(out, 'photo.png'));

// H.264 + AAC (codecs proprietários: suportados no Chrome/Edge/Safari, não no Chromium de testes).
ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=500:duration=2',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', join(out, 'clip-h264.mp4'));

// Arquivo corrompido com extensão de vídeo.
writeFileSync(join(out, 'corrupted.mp4'), Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) % 251)));
console.log('Fixtures geradas em', out);
