// IndexedDB – lokalna baza na uređaju. Fotografije (Blob) su u posebnom skladištu "photoData",
// da se pri pokretanju učitavaju samo podaci, a slike tek kad zatrebaju.

const DB_NAME = 'elektro-odrzavanje';
const VERSION = 1;
export const STORES = ['equipment', 'tasks', 'reports', 'photos', 'photoData'];

let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Baza je zauzeta. Zatvorite druge prozore aplikacije.'));
    });
  }
  return dbPromise;
}

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const txDone = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error || new Error('Transakcija je prekinuta.'));
});

export async function getAll(store) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, id) {
  const db = await openDB();
  return reqP(db.transaction(store).objectStore(store).get(id));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return txDone(tx);
}

/** Više izmena u jednoj transakciji: [{ store, put: value } | { store, del: id }] */
export async function batch(ops) {
  if (!ops.length) return;
  const db = await openDB();
  const names = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(names, 'readwrite');
  for (const o of ops) {
    const os = tx.objectStore(o.store);
    if ('put' in o) os.put(o.put);
    else os.delete(o.del);
  }
  return txDone(tx);
}

export async function clearAll() {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const s of STORES) tx.objectStore(s).clear();
  return txDone(tx);
}
