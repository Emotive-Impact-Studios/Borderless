import { mkdir, copyFile, writeFile, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
const app=join(root,'output/native/Borderless Native.app');
const build=join(root,'native/macos/.build/debug');
function run(command,args) {
  const result=spawnSync(command,args,{encoding:'utf8'});
  if(result.status!==0||result.error)throw new Error(result.error||result.stderr);
}
await mkdir(join(app,'Contents/MacOS'),{recursive:true});
await copyFile(join(build,'BorderlessMac'),join(app,'Contents/MacOS/BorderlessMac'));
// SwiftPM links these dynamic frameworks; the app must carry them when moved
// away from the checkout. Preserve relative framework symlinks and sign inside out.
await mkdir(join(app,'Contents/Frameworks'),{recursive:true});
for(const name of ['LiveKitWebRTC.framework','RustLiveKitUniFFI.framework']) {
  const destination=join(app,'Contents/Frameworks',name);
  await cp(join(build,name),destination,{recursive:true,verbatimSymlinks:true});
  run('codesign',['--force','--sign','-',destination]);
}
// These bundles contain privacy manifests only (neither dependency loads
// Bundle.module at runtime). Keep them in the signed app's Resources directory.
await mkdir(join(app,'Contents/Resources'),{recursive:true});
for(const name of ['LiveKit_LiveKit.bundle','SwiftProtobuf_SwiftProtobuf.bundle']) {
  await cp(join(build,name),join(app,'Contents/Resources',name),{recursive:true,verbatimSymlinks:true});
}
const notices=join(app,'Contents/Resources/ThirdPartyNotices');
await mkdir(notices,{recursive:true});
for(const [dependency,file] of [['client-sdk-swift','LICENSE'],['webrtc-xcframework','LICENSE'],['livekit-uniffi-xcframework','LICENSE'],['swift-protobuf','LICENSE.txt']]) {
  // SwiftPM checkouts are read-only; cp replaces an earlier read-only notice.
  await cp(join(root,'native/macos/.build/checkouts',dependency,file),join(notices,`${dependency}.txt`),{force:true});
}
run('install_name_tool',['-add_rpath','@executable_path/../Frameworks',join(app,'Contents/MacOS/BorderlessMac')]);
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
run('codesign',['--force','--sign','-',app]);
run('codesign',['--verify','--deep','--strict',app]);
console.log(`Local ad-hoc native adapter app: ${app}\nNot Developer ID signed, notarised or a release package.`);
