import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=join(root,'output/native/Borderless Native.app');
await mkdir(join(app,'Contents/MacOS'),{recursive:true});
await copyFile(join(root,'native/macos/.build/debug/BorderlessMac'),join(app,'Contents/MacOS/BorderlessMac'));
await writeFile(join(app,'Contents/Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Borderless Native</string>
<key>CFBundleIdentifier</key><string>studio.emotive.borderless.native</string>
<key>CFBundleExecutable</key><string>BorderlessMac</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>`);
const result=spawnSync('codesign',['--force','--sign','-',app],{encoding:'utf8'});
if(result.status!==0)throw new Error(result.stderr);
console.log(`Local ad-hoc native adapter app: ${app}\nNot Developer ID signed, notarised or a release package.`);
