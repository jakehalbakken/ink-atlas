// File handoff outside the artifact sandbox: use the native share sheet when the
// platform will accept the exact file, and fall back to a plain download otherwise.
// Per the v47 spec, a cancelled share keeps the file and never triggers a download.

function typeFor(name) {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.html?$/i.test(name)) return 'text/html';
  if (/\.json$/i.test(name)) return 'application/json';
  if (/\.usdz$/i.test(name)) return 'model/vnd.usdz+zip';
  if (/\.zip$/i.test(name)) return 'application/zip';
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.mp4$/i.test(name)) return 'video/mp4';
  if (/\.webm$/i.test(name)) return 'video/webm';
  return 'application/octet-stream';
}

export function dataUrlBlob(u) {
  const [h, b] = u.split(',');
  const bin = atob(b);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: (h.match(/:(.*?);/) || [])[1] || 'application/octet-stream' });
}

function toFile(filename, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: typeFor(filename) });
  return new File([blob], filename, { type: blob.type || typeFor(filename) });
}

// Whether this browser can hand a file to the OS share sheet at all.
export function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'probe.txt', { type: 'text/plain' })] })); }
  catch (_) { return false; }
}

// Returns 'shared' | 'downloaded' | 'cancelled'. Must be called from a user gesture
// so the native share sheet is allowed to open.
export async function shareOrDownload(filename, data) {
  const file = toFile(filename, data);
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; }
    catch (err) { if (err && err.name === 'AbortError') return 'cancelled'; /* otherwise fall back */ }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'downloaded';
}
