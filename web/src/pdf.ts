import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url';

GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdf(content: HTMLElement, url: string, name: string, signal: AbortSignal) {
  const canvas = document.createElement('canvas');
  const controls = document.createElement('div');
  controls.className = 'pdf-controls bl-glass';
  const previous = document.createElement('button');
  const next = document.createElement('button');
  const label = document.createElement('span');
  for (const button of [previous, next]) button.className = 'bl-button bl-button--small';
  previous.textContent = 'Previous';
  next.textContent = 'Next';
  previous.disabled = next.disabled = true;
  label.textContent = 'Opening PDF…';
  controls.append(previous, label, next);
  content.append(canvas, controls);
  const loading = getDocument({url, isEvalSupported:false, enableXfa:false, useWasm:false});
  let drawing: RenderTask | undefined;
  let current = 1;
  signal.addEventListener('abort', () => { drawing?.cancel(); void loading.destroy(); }, {once:true});
  function error() {
    if (signal.aborted) return;
    const download = document.createElement('a');
    download.className = 'bl-button';
    download.href = url + '?download=1';
    download.download = name;
    download.textContent = 'Download PDF';
    content.replaceChildren(download);
  }
  void loading.promise.then(async pdf => {
    async function show(number: number) {
      previous.disabled = next.disabled = true;
      const page = await pdf.getPage(number);
      if (signal.aborted) return;
      const unit = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:Math.min(2, 1920/Math.max(unit.width,unit.height))});
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      drawing = page.render({canvas, viewport});
      await drawing.promise;
      current = number;
      canvas.setAttribute('aria-label', name + ', page ' + current);
      label.textContent = current + ' of ' + pdf.numPages;
      previous.disabled = current === 1;
      next.disabled = current === pdf.numPages;
      page.cleanup();
    }
    previous.onclick = () => { void show(current-1).catch(error); };
    next.onclick = () => { void show(current+1).catch(error); };
    await show(1);
  }).catch(error);
}
