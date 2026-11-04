/// <reference types="vite/client" />
import { Room, RoomEvent, Track, ConnectionState, DisconnectReason } from 'livekit-client';
import './style.css';
import { FileWindow, isFile, type Recipient, type WallFile } from './files';

type Stream = { id: string; ownerId: string; ownerName: string; title: string; colour: string; x: number; y: number; w: number; h: number; version: number; z?: number; canReceive: boolean };
type State = { id: string; name: string; ended: boolean; items: unknown[]; devices: Recipient[]; streams: Stream[]; me: { id: string; role: string; csrf: string }; theme?: string };
type Grant = { url: string; room: string; token: string; publisher: boolean };
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wall = element('wall'), windows = element('windows'), empty = element('empty'), status = element('status'), connection = element('connection');
const route = location.pathname.match(/^\/app\/(wall|console)\/([a-zA-Z0-9_-]{8,48})\/?$/);
const roomID = route?.[2];
const files = new Map<string, FileWindow>();
const nodes = new Map<string, LiveWindow>();
let state: State | undefined;
let connected = false;
let socket: WebSocket | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/rooms/${roomID}/${path}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(body ? { 'X-Borderless-CSRF': state?.me.csrf ?? '' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(response.status === 401 ? 'Pair this Wall using a fresh invitation from the room leader.' : `Room action unavailable (${response.status}).`);
  return response.json() as Promise<T>;
}

function readState(input: unknown): State {
  const value = input as State;
  if (!value || value.id !== roomID || typeof value.name !== 'string' || typeof value.ended !== 'boolean' ||
      !value.me || typeof value.me.csrf !== 'string' || typeof value.me.id !== 'string' || typeof value.me.role !== 'string' ||
      !Array.isArray(value.items) || !Array.isArray(value.devices) || !Array.isArray(value.streams) || value.streams.length > 6 || value.streams.some(s =>
        !s || !/^[a-f0-9-]{36}$/.test(s.id) || typeof s.title !== 'string' || typeof s.ownerName !== 'string' ||
        typeof s.ownerId !== 'string' || !Number.isInteger(s.version) ||
        [s.x, s.y, s.w, s.h].some(n => !Number.isFinite(n) || n < 0 || n > 1))) throw new Error('Invalid room state.');
  return value;
}

function render(input: unknown) {
  state = readState(input);
  element('room-name').textContent = state.name;
  // Translate the compatibility hub's room looks to the approved design tokens.
  const looks: Record<string, string> = { classroom: 'whiteboard', studio: 'studio', executive: 'executive', command: 'tactical', synth: 'studio' };
  document.body.dataset.blTheme = looks[state.theme ?? ''] ?? 'whiteboard';
  if (state.ended) { disconnect('This room has ended.'); return; }
  const present = new Set(state.streams.filter(s => s.canReceive).map(s => s.id));
  for (const [id, node] of nodes) if (!present.has(id)) { node.close(); nodes.delete(id); }
  for (const stream of state.streams) {
    if (!stream.canReceive) continue;
    let node = nodes.get(stream.id);
    if (!node) { node = new LiveWindow(stream); nodes.set(stream.id, node); }
    node.update(stream);
  }
  const assets = state.items.filter(isFile);
  const ids = new Set(assets.map(item => item.id));
  for (const [id, node] of files) if (!ids.has(id)) { node.close(); files.delete(id); }
  for (const item of assets) {
    let node = files.get(item.id);
    if (!node) {
      node = new FileWindow(windows, roomID!, item, () => chooseRecipient(item));
      files.set(item.id, node);
      const tile = node;
      for (const [handle, operation] of [[tile.moveHandle,'move'],[tile.resizeHandle,'resize']] as const) {
        bindGesture(handle, operation, 'item', () => tile.model, () => connected && !tile.button.hidden,
          value => tile.bounds(value), active => { tile.dragging = active; });
      }
      if (connected) tile.root.classList.add('bl-arrive');
    }
    node.update(item, route?.[1] === 'console' && (state.me.role === 'admin' || state.me.id === item.ownerId));
  }
  const count = nodes.size + files.size;
  empty.hidden = count > 0;
  status.textContent = 'Send a file or live window to the Wall.';
  element('identity').toggleAttribute('data-busy', count >= 3);
}

function chooseRecipient(item: WallFile) {
  const dialog = element<HTMLDialogElement>('return-file');
  const select = element<HTMLSelectElement>('return-device');
  const send = element<HTMLButtonElement>('return-send');
  const message = element('return-status');
  select.replaceChildren(new Option('Choose a device', ''));
  for (const person of state?.devices ?? []) {
    if (person.role !== 'wall') select.add(new Option(person.name, person.id));
  }
  element('return-title').textContent = 'Send back ' + item.title;
  message.textContent = '';
  send.disabled = true;
  select.onchange = () => { send.disabled = !select.value; };
  const commandId = crypto.randomUUID();
  send.onclick = async () => {
    send.disabled = true;
    select.disabled = true;
    try {
      await api('command', { type:'delivery.send', assetId:item.assetId, deviceId:select.value, commandId });
      dialog.close();
      connection.textContent = 'Sent to ' + select.selectedOptions[0].text;
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Could not send the file.';
      send.disabled = false;
    } finally { select.disabled = false; }
  };
  dialog.showModal();
}

function disconnect(message: string) {
  element<HTMLDialogElement>('return-file').close();
  for (const file of files.values()) file.close();
  files.clear();
  connected = false;
  connection.textContent = message;
  status.textContent = message;
  for (const node of nodes.values()) node.close();
  nodes.clear(); empty.hidden = false;
}

async function join() {
  if (disposed || !roomID) return;
  try {
    const pair = new URLSearchParams(location.hash.slice(1)).get('pair');
    if (pair) {
      // A one-use invitation is consumed by the hub, then removed from history.
      await api('wall-pair', { token: pair, name: 'Wall' });
      history.replaceState(null, '', location.pathname);
    }
    render(await api('state'));
    if (state?.ended) return;
    const url = new URL(`/api/rooms/${roomID}/live`, location.origin);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url); socket = ws;
    ws.onmessage = event => {
      if (socket !== ws || disposed) return;
      try {
        if (typeof event.data !== 'string' || event.data.length > 4 * 1024 * 1024) throw new Error('Invalid room message.');
        const message = JSON.parse(event.data);
        if (message.type === 'hello') { connected = true; connection.textContent = route?.[1] === 'console' ? 'Console connected' : 'Wall connected'; }
        if (message.type === 'state') render(message.state);
      } catch { ws.close(); disconnect('Room connection could not be verified.'); }
    };
    ws.onclose = () => {
      if (socket !== ws || disposed) return;
      disconnect('Room disconnected · reconnecting…');
      retry = setTimeout(() => void join(), 3000);
    };
    ws.onerror = () => ws.close();
  } catch (error) { disconnect(error instanceof Error ? error.message : 'Unable to join this room.'); }
}

function text(className: string, value: string) {
  const node = document.createElement('span'); node.className = className; node.textContent = value; return node;
}

type Surface = Pick<Stream,'id'|'version'|'x'|'y'|'w'|'h'>;
function bindGesture(handle: HTMLElement, operation: 'move' | 'resize', kind: 'stream' | 'item',
  model: () => Surface, editable: () => boolean, bounds: (s: Surface) => void, dragging: (active: boolean) => void) {
  const idKey = kind === 'stream' ? 'streamId' : 'itemId';
    handle.setAttribute('aria-label', operation === 'move' ? 'Move window with arrow keys' : 'Resize window with arrow keys');
    handle.addEventListener('keydown', event => {
      if (!editable() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const s = model(), step = event.shiftKey ? .05 : .01;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      const geometry = operation === 'move' ? { x: Math.max(0, Math.min(1 - s.w, s.x + dx)), y: Math.max(0, Math.min(1 - s.h, s.y + dy)) }
        : { w: Math.max(.08, Math.min(1 - s.x, s.w + dx)), h: Math.max(.08, Math.min(1 - s.y, s.h + dy)) };
      void api('command', { type: `${kind}.${operation}`, [idKey]: s.id, version: s.version, commandId: crypto.randomUUID(), ...geometry })
        .catch(error => { connection.textContent = error.message; });
    });
    handle.addEventListener('pointerdown', event => {
      if (!editable() || event.button !== 0 || (operation === 'move' && (event.target as HTMLElement).closest('button, select, a'))) return;
      event.preventDefault(); handle.setPointerCapture(event.pointerId);
      const original = { ...model() }, start = { x: event.clientX, y: event.clientY };
      let next = { ...original }; dragging(true);
      const move = (e: PointerEvent) => {
        const dx = (e.clientX - start.x) / wall.clientWidth, dy = (e.clientY - start.y) / wall.clientHeight;
        next = operation === 'move' ? { ...original, x: Math.max(0, Math.min(1 - original.w, original.x + dx)), y: Math.max(0, Math.min(1 - original.h, original.y + dy)) }
          : { ...original, w: Math.max(.08, Math.min(1 - original.x, original.w + dx)), h: Math.max(.08, Math.min(1 - original.y, original.h + dy)) };
        bounds(next);
      };
      const finish = (e: PointerEvent) => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', finish);
        dragging(false); bounds(model());
        if (e.type === 'pointercancel' || !editable()) return;
        const geometry = operation === 'move' ? { x: next.x, y: next.y } : { w: next.w, h: next.h };
        void api('command', { type: `${kind}.${operation}`, [idKey]: original.id, version: original.version, commandId: crypto.randomUUID(), ...geometry })
          .catch(error => { connection.textContent = error.message; });
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
    });
  }

class LiveWindow {
  readonly root = document.createElement('section');
  private readonly video = document.createElement('video');
  private readonly title = text('bl-ornament__title', '');
  private readonly owner = text('bl-ornament__who', '');
  private readonly avatar = text('bl-avatar', '');
  private readonly label = text('bl-live', 'Connecting');
  private readonly placeholder = document.createElement('div');
  private readonly placeholderText = text('bl-toast bl-glass', 'Waiting for source');
  private readonly resize = document.createElement('button');
  private room?: Room;
  private closed = false;
  private connecting = false;
  private superseded = false;
  private retry?: ReturnType<typeof setTimeout>;
  private frame?: number;
  private dragging = false;
  private model: Stream;
  constructor(stream: Stream) {
    this.model = stream;
    this.root.className = 'bl-window'; this.root.dataset.live = 'paused';
    const content = document.createElement('div'); content.className = 'bl-window__content';
    this.video.autoplay = true; this.video.muted = true; this.video.playsInline = true;
    content.append(this.video);
    this.placeholder.className = 'bl-paused'; this.placeholder.append(this.placeholderText); content.append(this.placeholder);
    const ornament = document.createElement('div'); ornament.className = 'bl-ornament bl-glass'; ornament.tabIndex = 0;
    ornament.append(this.avatar, this.title, this.label, this.owner);
    this.resize.className = 'bl-icon-button resize'; this.resize.textContent = '↘'; this.resize.setAttribute('aria-label', 'Resize window');
    content.append(this.resize); this.root.append(content, ornament); windows.append(this.root);
    this.gesture(ornament, 'move'); this.gesture(this.resize, 'resize');
    this.video.addEventListener('waiting', () => this.paused('Buffering'));
    this.video.addEventListener('emptied', () => this.paused('Connecting'));
    void this.connect();
  }
  update(stream: Stream) {
    this.model = stream;
    this.title.textContent = stream.title; this.owner.textContent = stream.ownerName;
    this.avatar.textContent = stream.ownerName.slice(0, 1).toUpperCase();
    this.root.setAttribute('aria-label', `${stream.title} shared by ${stream.ownerName}`);
    // Stable owner mapping uses only design-system colours; legacy hex values
    // never become arbitrary CSS. The same owner keeps the same colour.
    const colours = ['blue', 'orange', 'green', 'pink', 'purple', 'teal', 'gold', 'indigo'];
    const legacy: Record<string, string> = { '#c76a39': 'orange', '#327c76': 'teal', '#7570b3': 'purple', '#c14b74': 'pink', '#397cba': 'blue', '#ae8428': 'gold' };
    const index = Array.from(stream.ownerId).reduce((sum, c) => sum + c.charCodeAt(0), 0) % colours.length;
    this.root.style.setProperty('--o', `var(--bl-owner-${legacy[stream.colour] ?? colours[index]})`);
    this.resize.hidden = !this.editable(); this.root.toggleAttribute('data-editable', this.editable());
    const ornament = this.root.querySelector<HTMLElement>('.bl-ornament')!;
    ornament.tabIndex = this.editable() ? 0 : -1;
    ornament.setAttribute('aria-label', this.editable() ? 'Move window with arrow keys' : `${stream.title}, ${stream.ownerName}`);
    if (!this.dragging) this.bounds(stream);
  }
  private editable() { return connected && route?.[1] === 'console' && (state?.me.role === 'admin' || state?.me.id === this.model.ownerId); }
  private bounds(s: Pick<Stream, 'x' | 'y' | 'w' | 'h'>) {
    Object.assign(this.root.style, { left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`, zIndex: String(this.model.z ?? 0) });
  }
  private paused(label: string) {
    this.root.dataset.live = 'paused'; this.label.textContent = label;
    this.placeholderText.textContent = label; this.placeholder.hidden = false;
  }
  private async connect() {
    if (this.closed || this.connecting || this.superseded) return;
    this.connecting = true;
    try {
      clearTimeout(this.retry);
      const old = this.room; this.room = undefined;
      old?.removeAllListeners(); await old?.disconnect();
      const grant = await api<Grant>(`streams/${this.model.id}/media`, {});
      if (this.closed) return;
      if (grant.publisher) throw new Error('View this window from a separate Wall session.');
      const url = new URL(grant.url);
      if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Trusted media transport is required.');
      if (url.username || url.password) throw new Error('Invalid media address.');
      // The single-layer Wall feed must stay subscribed while macOS moves a
      // window between Spaces. The Console can still suspend off-screen tiles.
      const room = new Room({ adaptiveStream: route?.[1] !== 'wall', dynacast: true });
      this.room = room;
      room.on(RoomEvent.TrackSubscribed, track => {
        if (this.closed || this.room !== room || track.kind !== Track.Kind.Video || track.source !== Track.Source.ScreenShare) return;
        track.attach(this.video);
        if (import.meta.env.MODE === 'frame-check') {
          void import('./frame-check').then(check => check.measureFrames(this.video, track));
        }
        const decoded = () => {
          if (!this.closed && this.room === room) {
            if (this.root.dataset.live !== '' && !track.isMuted && room.state === ConnectionState.Connected && this.video.srcObject) {
              this.root.dataset.live = ''; this.label.textContent = 'Live';
              this.placeholder.hidden = true;
            }
            this.frame = this.video.requestVideoFrameCallback(decoded);
          }
        };
        if (this.frame !== undefined) this.video.cancelVideoFrameCallback(this.frame);
        this.frame = this.video.requestVideoFrameCallback(decoded);
        void this.video.play().catch(() => this.paused('Playback needs a click'));
      });
      room.on(RoomEvent.TrackUnsubscribed, track => { track.detach(this.video); this.video.srcObject = null; this.paused('Waiting for source'); });
      room.on(RoomEvent.TrackMuted, () => this.paused('Paused at source'));
      room.on(RoomEvent.ConnectionStateChanged, value => {
        if (value !== ConnectionState.Connected) this.paused('Reconnecting');
        else if (!this.video.videoWidth) this.paused('Waiting for source');
      });
      room.on(RoomEvent.Disconnected, reason => {
        this.video.srcObject = null; this.paused('Reconnecting');
        clearTimeout(this.retry);
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          this.superseded = true; this.paused('This Wall is open in another window'); return;
        }
        if (!this.closed) this.retry = setTimeout(() => void this.connect(), 3000);
      });
      await room.connect(grant.url, grant.token);
      if (this.closed) await room.disconnect();
    } catch (error) {
      this.room?.removeAllListeners(); await this.room?.disconnect(); this.room = undefined;
      clearTimeout(this.retry);
      this.paused(error instanceof Error ? error.message : 'Media unavailable');
      if (!this.closed && !this.superseded) this.retry = setTimeout(() => void this.connect(), 10000);
    } finally { this.connecting = false; }
  }
  private gesture(handle: HTMLElement, operation: 'move' | 'resize') {
    bindGesture(handle, operation, 'stream', () => this.model, () => this.editable(),
      value => this.bounds(value), active => { this.dragging = active; });
  }

  close() {
    this.closed = true; clearTimeout(this.retry);
    if (this.frame !== undefined) this.video.cancelVideoFrameCallback(this.frame);
    this.video.pause(); this.video.srcObject = null;
    this.room?.removeAllListeners(); void this.room?.disconnect(); this.root.remove();
  }
}

element('fullscreen').onclick = () => void (document.fullscreenElement ? document.exitFullscreen() : wall.requestFullscreen());
let idle: ReturnType<typeof setTimeout>;
wall.addEventListener('pointermove', () => {
  element('tools').removeAttribute('data-idle'); clearTimeout(idle);
  idle = setTimeout(() => element('tools').setAttribute('data-idle', ''), 4000);
});
window.addEventListener('pagehide', () => { disposed = true; clearTimeout(retry); socket?.close(); for (const node of nodes.values()) node.close(); });
if (roomID) void join(); else {
  empty.hidden = true; element('identity').hidden = true;
  const form = element<HTMLFormElement>('pair-form'); form.hidden = false;
  form.onsubmit = event => {
    event.preventDefault();
    try {
      const url = new URL(element<HTMLInputElement>('wall-link').value.trim());
      const match = url.pathname.match(/^\/(?:app\/)?wall\/([a-zA-Z0-9_-]{8,48})$/);
      if (!match || url.username || url.password || url.search ||
          (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Use a trusted HTTPS Wall invitation.');
      url.pathname = `/app/wall/${match[1]}`;
      location.assign(url.href);
    } catch { element('pair-status').textContent = 'Paste the complete Wall invitation from the leader. Use trusted HTTPS outside this computer.'; }
  };
}
