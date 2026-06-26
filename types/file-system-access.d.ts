interface FileSystemHandle {
  requestPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied'>;
  queryPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied'>;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }): Promise<FileSystemDirectoryHandle>;
}
