export type WallFile = {
  id: string; version: number; assetId: string; kind: 'file'; title: string; mime: string;
  ownerId: string; ownerName: string; colour?: string; page?: number; playback?: { playing: boolean; position: number; at: number }; x: number; y: number; w: number; h: number; z: number;
};
import { ownerColour } from './arrival';
export type Recipient = { id: string; name: string; role: string };
const uuid = /^[a-f0-9-]{36}$/i;
export function isFile(value: unknown): value is WallFile {
  const f = value as WallFile | null;
  return !!f && Number.isInteger(f.version) && f.kind === 'file' && (f.page === undefined || Number.isInteger(f.page)) && uuid.test(f.id) && uuid.test(f.assetId) &&
    [f.title, f.mime, f.ownerId, f.ownerName].every(s => typeof s === 'string') &&
    [f.x, f.y, f.w, f.h].every(n => Number.isFinite(n) && n >= 0 && n <= 1);
}

export class FileWindow {
  private readonly lifetime = new AbortController();
  dragging = false;
  model: WallFile;
  readonly moveHandle = document.createElement('div');
  readonly resizeHandle = document.createElement('button');
  readonly root = document.createElement('section');
  readonly button = document.createElement('button');
  private readonly title = document.createElement('span');
  private readonly owner = document.createElement('span');
  private pdf?: import('./pdf').PdfView;
  private editable = false;
  private media?: HTMLMediaElement;
  private applying = false;
  constructor(parent: HTMLElement, room: string, file: WallFile, sendBack: () => void, turn: (page: number) => void = () => {}, play: (playing: boolean, position: number) => void = () => {}) {
    this.model = file;
    this.root.className = 'bl-window';
    const content = document.createElement('div');
    content.className = 'bl-window__content file-content';
    const url = `/api/rooms/${room}/assets/${file.assetId}`;
    if (['image/png','image/jpeg','image/webp','image/gif'].includes(file.mime)) {
      const image = document.createElement('img');
      image.alt = file.title;
      image.src = url;
      content.append(image);
    } else if (file.mime === 'application/pdf') {
      void import('./pdf').then(({openPdf}) => {
        if (this.lifetime.signal.aborted) return;
        this.pdf = openPdf(content, url, file.title, this.lifetime.signal, turn);
        this.pdf.setEditable(this.editable); this.pdf.show(this.model.page ?? 1);
      });
    } else if (file.mime.startsWith('video/') || file.mime.startsWith('audio/')) {
      // One playback for the room: people who can edit drive it, everyone follows.
      const media = document.createElement(file.mime.startsWith('video/') ? 'video' : 'audio');
      media.setAttribute('playsinline', '');
      media.src = url;
      for (const type of ['play', 'pause', 'seeked']) media.addEventListener(type, () => {
        if (!this.applying && this.editable) play(!media.paused, media.currentTime);
      });
      this.media = media;
      content.append(media);
    } else {
      const download = document.createElement('a');
      download.className = 'bl-button';
      download.href = url + '?download=1';
      download.download = file.title;
      download.textContent = 'Download ' + file.title;
      content.append(download);
    }
    const ornament = this.moveHandle;
    ornament.className = 'bl-ornament bl-glass';
    this.title.className = 'bl-ornament__title';
    this.owner.className = 'bl-ornament__who';
    this.button.className = 'bl-button bl-button--small';
    this.button.textContent = 'Send back';
    this.button.onclick = sendBack;
    ornament.append(this.title, this.owner, this.button);
    this.resizeHandle.className = 'bl-icon-button resize';
    this.resizeHandle.textContent = '↘';
    content.append(this.resizeHandle);
    this.root.append(content, ornament);
    parent.append(this.root);
  }
  close() { this.lifetime.abort(); this.root.remove(); }
  update(file: WallFile, canReturn: boolean) {
    this.model = file;
    this.editable = canReturn;
    this.pdf?.setEditable(canReturn); this.pdf?.show(file.page ?? 1);
    if (this.media) {
      this.media.controls = canReturn;
      const p = file.playback;
      if (p) {
        const target = p.position + (p.playing ? Math.max(0, Date.now() - p.at) / 1000 : 0);
        this.applying = true;
        if (Math.abs(this.media.currentTime - target) > 0.5) this.media.currentTime = target;
        if (p.playing && this.media.paused) void this.media.play().catch(() => { this.media!.muted = true; void this.media!.play().catch(() => {}); });
        if (!p.playing && !this.media.paused) this.media.pause();
        setTimeout(() => { this.applying = false; }, 300);
      }
    }
    this.resizeHandle.hidden = !canReturn;
    this.moveHandle.tabIndex = canReturn ? 0 : -1;
    this.root.toggleAttribute('data-editable', canReturn);
    this.root.setAttribute('aria-label', file.title);
    this.root.style.setProperty('--o', ownerColour(file.ownerId, file.colour));
    this.title.textContent = file.title;
    this.owner.textContent = file.ownerName;
    this.button.hidden = !canReturn;
    if (!this.dragging) this.bounds(file);
  }
  bounds(file: Pick<WallFile,'x'|'y'|'w'|'h'>) {
    Object.assign(this.root.style,{left:`${file.x*100}%`,top:`${file.y*100}%`,width:`${file.w*100}%`,height:`${file.h*100}%`,zIndex:String(this.model.z ?? 0)});
  }
}

export type WallLink = {
  id: string; version: number; kind: 'link'; url: string; host: string; title: string; site: string; description: string;
  preview: 'pending' | 'ready' | 'unavailable'; ownerId: string; ownerName: string; colour?: string;
  x: number; y: number; w: number; h: number; z: number;
};
export function isLink(value: unknown): value is WallLink {
  const l = value as WallLink | null;
  if (!l || l.kind !== 'link' || !Number.isInteger(l.version) || !uuid.test(l.id)) return false;
  if (![l.url, l.host, l.title, l.site, l.description, l.ownerId, l.ownerName].every(s => typeof s === 'string')) return false;
  if (!['pending', 'ready', 'unavailable'].includes(l.preview) || ![l.x, l.y, l.w, l.h].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return false;
  try { const u = new URL(l.url); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

/** PRD B42 preview card. The live sandboxed page view needs the Tauri shell and is not built yet. */
export class LinkWindow {
  dragging = false;
  model: WallLink;
  readonly moveHandle = document.createElement('div');
  readonly resizeHandle = document.createElement('button');
  readonly root = document.createElement('section');
  readonly button = document.createElement('button');
  private readonly heading = document.createElement('h2');
  private readonly site = document.createElement('p');
  private readonly description = document.createElement('p');
  private readonly address = document.createElement('p');
  private readonly title = document.createElement('span');
  private readonly owner = document.createElement('span');
  constructor(parent: HTMLElement, link: WallLink) {
    this.model = link;
    this.root.className = 'bl-window';
    const content = document.createElement('div');
    content.className = 'bl-window__content link-content';
    this.site.className = 'link-site'; this.heading.className = 'link-title';
    this.description.className = 'link-description'; this.address.className = 'link-address';
    content.append(this.site, this.heading, this.description, this.address);
    this.moveHandle.className = 'bl-ornament bl-glass';
    this.title.className = 'bl-ornament__title'; this.owner.className = 'bl-ornament__who';
    this.button.hidden = true;
    this.moveHandle.append(this.title, this.owner);
    this.resizeHandle.className = 'bl-icon-button resize'; this.resizeHandle.textContent = '↘';
    content.append(this.resizeHandle);
    this.root.append(content, this.moveHandle);
    parent.append(this.root);
  }
  close() { this.root.remove(); }
  update(link: WallLink, editable: boolean) {
    this.model = link;
    this.resizeHandle.hidden = !editable;
    this.moveHandle.tabIndex = editable ? 0 : -1;
    this.root.toggleAttribute('data-editable', editable);
    this.root.dataset.preview = link.preview;
    this.root.setAttribute('aria-label', link.title);
    this.root.style.setProperty('--o', ownerColour(link.ownerId, link.colour));
    this.site.textContent = link.site ? `${link.site} · ${link.host}` : link.host;
    this.heading.textContent = link.preview === 'pending' ? 'Opening preview…' : link.title;
    this.description.textContent = link.description;
    this.description.hidden = !link.description;
    this.address.textContent = link.url;
    this.title.textContent = link.host;
    this.owner.textContent = link.ownerName;
    if (!this.dragging) this.bounds(link);
  }
  bounds(link: Pick<WallLink,'x'|'y'|'w'|'h'>) {
    Object.assign(this.root.style,{left:`${link.x*100}%`,top:`${link.y*100}%`,width:`${link.w*100}%`,height:`${link.h*100}%`,zIndex:String(this.model.z ?? 0)});
  }
}

export type WallNote = {
  id: string; version: number; kind: 'note'; title: string; text: string; ownerId: string; ownerName: string; colour?: string;
  x: number; y: number; w: number; h: number; z: number;
};
export function isNote(value: unknown): value is WallNote {
  const n = value as WallNote | null;
  return !!n && n.kind === 'note' && Number.isInteger(n.version) && uuid.test(n.id) &&
    [n.title, n.text, n.ownerId, n.ownerName].every(s => typeof s === 'string') &&
    [n.x, n.y, n.w, n.h].every(v => Number.isFinite(v) && v >= 0 && v <= 1);
}

/** A thought on the Wall: a flat, readable card in its owner's colour (no tilt). */
export class NoteWindow {
  dragging = false;
  model: WallNote;
  readonly moveHandle = document.createElement('div');
  readonly resizeHandle = document.createElement('button');
  readonly root = document.createElement('section');
  readonly button = document.createElement('button');
  private readonly heading = document.createElement('h2');
  private readonly body = document.createElement('p');
  private readonly title = document.createElement('span');
  private readonly owner = document.createElement('span');
  constructor(parent: HTMLElement, note: WallNote) {
    this.model = note;
    this.root.className = 'bl-window';
    const content = document.createElement('div');
    content.className = 'bl-window__content note-content';
    this.heading.className = 'note-title'; this.body.className = 'note-text';
    content.append(this.heading, this.body);
    this.moveHandle.className = 'bl-ornament bl-glass';
    this.title.className = 'bl-ornament__title'; this.owner.className = 'bl-ornament__who';
    this.button.hidden = true;
    this.moveHandle.append(this.title, this.owner);
    this.resizeHandle.className = 'bl-icon-button resize'; this.resizeHandle.textContent = '↘';
    content.append(this.resizeHandle);
    this.root.append(content, this.moveHandle);
    parent.append(this.root);
  }
  close() { this.root.remove(); }
  update(note: WallNote, editable: boolean) {
    this.model = note;
    this.resizeHandle.hidden = !editable;
    this.moveHandle.tabIndex = editable ? 0 : -1;
    this.root.toggleAttribute('data-editable', editable);
    this.root.setAttribute('aria-label', note.title);
    this.root.style.setProperty('--o', ownerColour(note.ownerId, note.colour));
    this.heading.textContent = note.title;
    this.body.textContent = note.text;
    this.title.textContent = 'Thought';
    this.owner.textContent = note.ownerName;
    if (!this.dragging) this.bounds(note);
  }
  bounds(note: Pick<WallNote,'x'|'y'|'w'|'h'>) {
    Object.assign(this.root.style,{left:`${note.x*100}%`,top:`${note.y*100}%`,width:`${note.w*100}%`,height:`${note.h*100}%`,zIndex:String(this.model.z ?? 0)});
  }
}
