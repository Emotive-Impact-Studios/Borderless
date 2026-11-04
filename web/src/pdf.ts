import { getDocument, GlobalWorkerOptions, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&url';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfView = { show(page: number): void; setEditable(editable: boolean): void };

/** Renders the hub's shared page. Turning a page asks the hub (onTurn); every
 *  viewer, including this one, then follows the authoritative page number. */
export function openPdf(content: HTMLElement, url: string, name: string, signal: AbortSignal, onTurn: (page: number) => void): PdfView {
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
  let current = 0, wanted = 1, editable = false, busy = false, pages = 0;
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
  function buttons() {
    previous.hidden = next.hidden = !editable;
    previous.disabled = busy || current <= 1;
    next.disabled = busy || !pages || current >= pages;
  }
  let pdfDocument: Awaited<typeof loading.promise> | undefined;
  async function render() {
    // Always converge on the latest wanted page, even if several arrive while drawing.
    if (!pdfDocument || busy) return;
    const target = Math.min(Math.max(1, wanted), pages);
    if (target === current) return;
    busy = true; buttons();
    try {
      const page = await pdfDocument.getPage(target);
      if (signal.aborted) return;
      const unit = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:Math.min(2, 1920/Math.max(unit.width,unit.height))});
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      drawing = page.render({canvas, viewport});
      await drawing.promise;
      current = target;
      canvas.setAttribute('aria-label', name + ', page ' + current);
      label.textContent = current + ' of ' + pages;
      page.cleanup();
    } finally { busy = false; buttons(); }
    void render().catch(error);
  }
  previous.onclick = () => onTurn(current - 1);
  next.onclick = () => onTurn(current + 1);
  void loading.promise.then(pdf => { pdfDocument = pdf; pages = pdf.numPages; return render(); }).catch(error);
  buttons();
  return {
    show(page: number) { wanted = page; void render().catch(error); },
    setEditable(value: boolean) { editable = value; buttons(); },
  };
}
