import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createApp } from '../server/app.mjs';

// Disposable, loopback-only conformance fixture. No saved user room is opened.
const dataDir=await mkdtemp(join(tmpdir(),'borderless-native-room-'));
const app=await createApp({dataDir,host:'127.0.0.1',port:0});
try {
  const origin=app.localURL;
  const created=await fetch(`${origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin},
    body:JSON.stringify({name:'Native conformance',adminName:'Fixture leader',password:'fixture-native-password',mode:'studio'})});
  if(!created.ok)throw new Error(`Room fixture failed: ${created.status} ${await created.text()}`);
  const cookie=created.headers.get('set-cookie').split(';')[0];
  const {roomId}=await created.json();
  const state=await (await fetch(`${origin}/api/rooms/${roomId}/state`,{headers:{cookie}})).json();
  const pairing=await fetch(`${origin}/api/rooms/${roomId}/pair`,{method:'POST',headers:{cookie,origin,'x-borderless-csrf':state.me.csrf}});
  if(!pairing.ok)throw new Error(`Pair failed ${pairing.status}`);
  const token=new URL((await pairing.json()).url).hash.slice('#pair='.length);
  const dotnet=process.env.BORDERLESS_DOTNET || join(homedir(),'.dotnet/dotnet');
  const child=spawn(dotnet,['run','--project','native/dotnet/Borderless.Native.Tests','--',origin,roomId],{
    env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DYLD_LIBRARY_PATH:join(process.cwd(),'native/core/target/debug'),LD_LIBRARY_PATH:join(process.cwd(),'native/core/target/debug')},
    stdio:['pipe','inherit','inherit']});
  child.stdin.end(`${token}\n`);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
  if(code!==0)throw new Error(`Native client failed (${code})`);
} finally {await app.close(); await rm(dataDir,{recursive:true,force:true});}
