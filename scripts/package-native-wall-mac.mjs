import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Local double-clickable bundle of the native Rust Wall (milestone 2N).
// Ad-hoc development signing only: not a signed, notarised or published release.
if (process.platform !== 'darwin') throw new Error('This local bundle requires macOS.');
const root = fileURLToPath(new URL('..', import.meta.url));
const build = spawnSync('cargo', ['build', '--release', '--locked'], { cwd: join(root, 'wall'), stdio: 'inherit' });
if (build.status !== 0) throw new Error('The native Wall did not build.');
const app = join(root, 'output/native/Borderless Wall Native.app');
await mkdir(join(app, 'Contents/MacOS'), { recursive: true });
await copyFile(join(root, 'wall/target/release/borderless-wall'), join(app, 'Contents/MacOS/borderless-wall'));
await writeFile(join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Borderless Wall</string>
<key>CFBundleDisplayName</key><string>Borderless Wall</string>
<key>CFBundleIdentifier</key><string>studio.emotive.borderless.wall.native</string>
<key>CFBundleExecutable</key><string>borderless-wall</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>`);
for (const args of [['--force', '--sign', '-', app], ['--verify', '--deep', '--strict', app]]) {
  const result = spawnSync('codesign', args, { encoding: 'utf8' });
  if (result.status !== 0 || result.error) throw new Error(result.error || result.stderr);
}
console.log(`Native Wall: ${app}\nOpen it, paste the Wall invitation, press Return. It resumes that room on the same display next time.\nAd-hoc development signing only; no release publication.`);
