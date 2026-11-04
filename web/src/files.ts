export type WallFile = {
  id: string; version: number; assetId: string; kind: 'file'; title: string; mime: string;
  ownerId: string; ownerName: string; colour?: string; x: number; y: number; w: number; h: number; z: number;
};
import { ownerColour } from './arrival';
export type Recipient = { id: string; name: string; role: string };
const uuid = /^[a-f0-9-]{36}$/i;
export function isFile(value: unknown): value is WallFile {
  const f = value as WallFile | null;
  return !!f && Number.isInteger(f.version) && f.kind === 'file' && uuid.test(f.id) && uuid.test(f.assetId) &&
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
  constructor(parent: HTMLElement, room: string, file: WallFile, sendBack: () => void) {
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
        if (!this.lifetime.signal.aborted) openPdf(content, url, file.title, this.lifetime.signal);
      });
    } else if (file.mime.startsWith('video/') || file.mime.startsWith('audio/')) {
      const media = document.createElement(file.mime.startsWith('video/') ? 'video' : 'audio');
      media.controls = true;
      media.src = url;
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
