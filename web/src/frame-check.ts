// Included only in the explicit Vite frame-check build.
import type { RemoteTrack } from 'livekit-client';

export async function measureFrames(video: HTMLVideoElement, track: RemoteTrack) {
  const output = document.createElement('output');
  document.getElementById('frame-check')?.remove();
  output.id = 'frame-check';
  output.className = 'bl-glass';
  document.querySelector('#identity')?.append(output);
  output.textContent = 'Frame check running';
  async function health() {
    const report = await track.getRTCStatsReport().catch(() => undefined);
    let inbound = {};
    report?.forEach(s => {
      if (s.type === 'inbound-rtp' && (s.kind === 'video' || s.mediaType === 'video')) {
        inbound = { bytes:s.bytesReceived, decoded:s.framesDecoded, received:s.framesReceived,
          lost:s.packetsLost, dropped:s.framesDropped, freezes:s.freezeCount };
      }
    });
    return { state:track.streamState, hidden:document.hidden, paused:video.paused,
      ready:video.readyState, width:video.videoWidth, height:video.videoHeight, inbound };
  }
  const originalStream = video.srcObject;
  const initial = await health();
  const sample = setInterval(async () => {
    output.setAttribute('aria-label', 'Frame check sampling ' + JSON.stringify(await health()));
  }, 5000);
  const gaps: number[] = [];
  let first: VideoFrameCallbackMetadata | undefined;
  let last: VideoFrameCallbackMetadata | undefined;
  let worst: Record<string, number | string | null> = { gap: 0 };
  let callback: number;
  const started = performance.now();
  const observe: VideoFrameRequestCallback = (_, frame) => {
    first ??= frame;
    if (last) {
      const gap = frame.presentationTime - last.presentationTime;
      gaps.push(gap);
      if (gap > Number(worst.gap)) worst = {
        gap, visibility: document.visibilityState, frameDelta: frame.presentedFrames - last.presentedFrames,
        receiveGap: frame.receiveTime !== undefined && last.receiveTime !== undefined ? frame.receiveTime-last.receiveTime : null,
        rtpGap: frame.rtpTimestamp !== undefined && last.rtpTimestamp !== undefined ? ((frame.rtpTimestamp-last.rtpTimestamp) >>> 0)/90 : null
      };
    }
    last = frame;
    callback = video.requestVideoFrameCallback(observe);
  };
  callback = video.requestVideoFrameCallback(observe);
  await new Promise(resolve => setTimeout(resolve, 60_000));
  clearInterval(sample);
  video.cancelVideoFrameCallback(callback);
  const ended = performance.now();
  const final = await health();
  output.removeAttribute('aria-label');
  if (!video.isConnected || video.srcObject !== originalStream) { output.textContent = 'Frame check interrupted'; return; }
  if (!first || !last || !gaps.length) { output.textContent = 'Frame check no advancing frames ' + JSON.stringify({initial,final}); return; }
  gaps.sort((a,b) => a-b);
  const frames = last.presentedFrames-first.presentedFrames;
  const span = last.presentationTime-first.presentationTime;
  output.textContent = 'Frame check ' + JSON.stringify({ width:last.width, height:last.height, frames, span,
    fps:frames*1000/(ended - started), p95Gap:gaps[Math.floor(gaps.length*.95)], gapsOver100:gaps.filter(g=>g>100).length,
    tail:ended - last.presentationTime, worst, elapsed:ended - started, initial, final });
}
