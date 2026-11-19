import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// pdf.js는 ArrayBuffer를 워커로 넘기며 소유권을 가져가므로 항상 복사본을 넘긴다.
export function openPdf(buf) {
  return pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
}
