import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.slice(0, 300)));
await p.goto(process.argv[2]);
await p.waitForTimeout(2000);
console.log('len', (await p.content()).length);
await b.close();
