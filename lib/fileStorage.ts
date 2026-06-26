'use client';

const DB_NAME = 'MeetMindStorage';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'saveDir';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const get = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
    get.onerror = () => { db.close(); reject(get.error); };
  });
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export function supportsFileSystemAPI(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function getDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTimestampStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

export async function saveBlobToFolder(
  rootHandle: FileSystemDirectoryHandle,
  blob: Blob,
  filename: string,
): Promise<void> {
  const dateStr = getDateStr();
  const dateDir = await rootHandle.getDirectoryHandle(dateStr, { create: true });
  const fileHandle = await dateDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function triggerFallbackDownload(videoBlob: Blob, audioBlob: Blob | null) {
  const ts = getTimestampStr();

  const videoUrl = URL.createObjectURL(videoBlob);
  const videoA = document.createElement('a');
  videoA.href = videoUrl;
  videoA.download = `${ts}_meeting.mp4`;
  videoA.click();
  URL.revokeObjectURL(videoUrl);

  if (audioBlob) {
    setTimeout(() => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioA = document.createElement('a');
      audioA.href = audioUrl;
      audioA.download = `${ts}_audio.webm`;
      audioA.click();
      URL.revokeObjectURL(audioUrl);
    }, 500);
  }
}
