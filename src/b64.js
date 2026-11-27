// Base64 to bytes, fast: the body, rig and shape data are megabytes of base64 decoded at start.
// The browser's own decoder where it has one (Uint8Array.fromBase64), otherwise a table, which is
// several times quicker than atob and a character at a time.
const T = new Uint8Array(256);
{ const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; for (let i = 0; i < 64; i++) T[a.charCodeAt(i)] = i; T[45] = 62; T[95] = 63; }

export function b64bytes(s) {
  if (typeof Uint8Array.fromBase64 === 'function') { try { return Uint8Array.fromBase64(s); } catch (e) { /* the table below */ } }
  let n = s.length; while (n && s.charCodeAt(n - 1) === 61) n--;
  const out = new Uint8Array((n * 3) >> 2);
  let o = 0, i = 0;
  for (const end = n - (n & 3); i < end; i += 4) {
    const v = (T[s.charCodeAt(i)] << 18) | (T[s.charCodeAt(i + 1)] << 12) | (T[s.charCodeAt(i + 2)] << 6) | T[s.charCodeAt(i + 3)];
    out[o++] = v >> 16; out[o++] = (v >> 8) & 255; out[o++] = v & 255;
  }
  const r = n & 3;
  if (r >= 2) { const v = (T[s.charCodeAt(i)] << 18) | (T[s.charCodeAt(i + 1)] << 12) | (r === 3 ? T[s.charCodeAt(i + 2)] << 6 : 0); out[o++] = v >> 16; if (r === 3) out[o++] = (v >> 8) & 255; }
  return out;
}
// a typed array over the decoded bytes (copied when they do not line up with the type)
export function b64typed(s, Type) {
  const u = b64bytes(s);
  if (u.byteOffset % (Type.BYTES_PER_ELEMENT || 1) === 0 && u.byteLength % (Type.BYTES_PER_ELEMENT || 1) === 0) return new Type(u.buffer, u.byteOffset, u.byteLength / (Type.BYTES_PER_ELEMENT || 1));
  return new Type(u.slice().buffer);
}
