import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const local=(path,fallback)=>existsSync(path)?path:fallback;
const cargo=process.env.BORDERLESS_CARGO||local(join(homedir(),'.cargo/bin/cargo'),'cargo');
const dotnet=process.env.BORDERLESS_DOTNET||
  (process.env.DOTNET_ROOT ? join(process.env.DOTNET_ROOT,'dotnet') : local(join(homedir(),'.dotnet/dotnet'),'dotnet'));
const library=join(root,'native/core/target/debug');
const env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_GENERATE_ASPNET_CERTIFICATE:'false',
  BORDERLESS_DOTNET:dotnet,DYLD_LIBRARY_PATH:library,LD_LIBRARY_PATH:library,
  PATH:`${dirname(dotnet)}${process.platform==='win32'?';':':'}${process.env.PATH}`};
function run(cmd,args,cwd=root) {
  console.log(`\nNative check: ${cmd} ${args.join(' ')}`);
  const result=spawnSync(cmd,args,{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024,timeout:180_000});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  if(result.status!==0||result.error)throw new Error(`${cmd} failed: ${result.error||result.status}`);
  // Godot can exit zero despite engine errors. Treat its diagnostic as failure.
  if(cmd===process.env.BORDERLESS_GODOT && /(?:^|\n)ERROR:/.test(result.stdout+result.stderr))throw new Error('Godot emitted an engine error.');
}
const core=join(root,'native/core');
run(cargo,['fmt','--check'],core);
run(cargo,['clippy','--all-targets','--','-D','warnings'],core);
run(cargo,['test','--locked'],core);
run(cargo,['build','--locked'],core);
run('go',['test','-race','./...'],join(root,'native/hub'));
run(dotnet,['build','native/dotnet/Borderless.Native.Tests']);
run(process.execPath,['scripts/test-native-room.mjs']);
if(process.platform==='darwin')run('swift',['test'],join(root,'native/macos'));
run(dotnet,['build','native/wall/Borderless.Wall.csproj']);
if(process.env.BORDERLESS_GODOT) {
  run(process.env.BORDERLESS_GODOT,['--headless','--path',join(root,'native/wall'),'--editor','--import','--quit']);
  run(process.env.BORDERLESS_GODOT,['--headless','--path',join(root,'native/wall'),'--','--smoke']);
} else console.log('Godot runtime not supplied: scene compilation only; no engine execution claim. Set BORDERLESS_GODOT for the scene gate.');
console.log('Native code checks passed. OS capture, Windows driver, LAN and physical devices are separate gates.');
