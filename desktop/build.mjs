import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(import.meta.url);
const manifestPath=require.resolve('electron-builder/package.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const bin=typeof manifest.bin==='string'?manifest.bin:manifest.bin['electron-builder'];
const result=spawnSync(process.execPath,[join(dirname(manifestPath),bin),'--config','desktop/electron-builder.json',...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
process.exitCode=result.status??1;
