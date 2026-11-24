'use strict';
const qs = new URLSearchParams(location.search);
const file = qs.get('file') || '';
const page0 = parseInt(qs.get('page') || '1', 10);
const rect = qs.get('rect') ? qs.get('rect').split(',').map(Number) : null;
document.getElementById('name').textContent = qs.get('name') || file.split('/').pop();

(async () => {
  try {
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument(file).promise;
    const view = document.getElementById('view');
    const info = document.getElementById('pages');
    let page = Math.min(Math.max(1, page0), doc.numPages);
    async function paint() {
      info.textContent = page + ' / ' + doc.numPages;
      view.innerHTML = '';
      const p = await doc.getPage(page);
      const vp = p.getViewport({ scale: 1.6 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      view.appendChild(cv);
      await p.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      if (rect && page === page0) {
        const s = vp.scale;
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;border:2px solid #e06c62;background:rgba(224,108,98,.18);pointer-events:none;' +
          `left:${cv.offsetLeft + rect[0] * s}px;top:${cv.offsetTop + rect[1] * s}px;width:${(rect[2] - rect[0]) * s}px;height:${(rect[3] - rect[1]) * s}px`;
        view.appendChild(el);
        el.scrollIntoView({ block: 'center' });
      }
    }
    document.getElementById('prev').onclick = () => { if (page > 1) { page--; paint(); } };
    document.getElementById('next').onclick = () => { if (page < doc.numPages) { page++; paint(); } };
    await paint();
  } catch (e) {
    document.getElementById('view').textContent = 'PDF 打开失败：' + e.message;
  }
})();