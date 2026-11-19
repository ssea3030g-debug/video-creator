// IndexedDB: papers(메타+파싱결과), files(원본 PDF), state(풀이 상태)
const NAME = 'exam-app';
let dbp;
function open() {
  return (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      for (const s of ['papers', 'files', 'state']) r.result.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}
export const get = (s, k) => tx(s, 'readonly', (o) => o.get(k));
export const put = (s, k, v) => tx(s, 'readwrite', (o) => o.put(v, k));
export const del = (s, k) => tx(s, 'readwrite', (o) => o.delete(k));
export const all = (s) => tx(s, 'readonly', (o) => o.getAll());

export async function sha(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}
