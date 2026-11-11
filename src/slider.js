// <ink-slider min max step value default origin>: a touch-first range control.
// Why not <input type=range>: on iPad a drag on the native control can pan the
// page or scroll the panel under the finger. This one takes horizontal drags
// itself and leaves vertical ones to the panel (touch-action: pan-y), so the
// screen never shifts. Tap anywhere on the track to jump, double-tap to reset.
// It mirrors the native API the app uses: `.value`, and `input` / `change` events.
const PAD = 13; // half the thumb, so the thumb stays inside the track

class InkSlider extends HTMLElement {
  connectedCallback() {
    if (this._built) return; this._built = true;
    this.setAttribute('role', 'slider'); this.tabIndex = 0;
    this.innerHTML = '<span class="sl-track"><span class="sl-fill"></span></span><span class="sl-thumb"></span>';
    if (this._v == null) this._v = this.hasAttribute('value') ? +this.getAttribute('value') : (this.resetValue ?? this.min);
    this._paint();
    let drag = null, lastTap = 0;
    const fromX = (x) => { const r = this.getBoundingClientRect(); const k = (x - r.left - PAD) / Math.max(1, r.width - 2 * PAD); return this.min + Math.min(1, Math.max(0, k)) * (this.max - this.min); };
    const emit = (type) => this.dispatchEvent(new Event(type, { bubbles: true }));
    const put = (v) => { const before = this._v; this.value = v; if (this._v !== before) { emit('input'); return true; } return false; };
    this.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { this.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      drag = { id: e.pointerId, x: e.clientX, v0: this._v, moved: false, changed: false };
    });
    this.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return; // wait: this may be a vertical scroll
      drag.moved = true; if (put(fromX(e.clientX))) drag.changed = true;
    });
    this.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null;
      if (!d.moved) {
        const now = performance.now();
        if (now - lastTap < 320 && this.resetValue != null) { lastTap = 0; if (put(this.resetValue)) d.changed = true; } else { lastTap = now; if (put(fromX(e.clientX))) d.changed = true; }
      }
      if (d.changed) emit('change');
    });
    this.addEventListener('pointercancel', (e) => {
      if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null;
      if (d.changed) { put(d.v0); emit('change'); } // the browser took the gesture (a scroll): undo our part
    });
    this.addEventListener('keydown', (e) => {
      const step = this.step || (this.max - this.min) / 50; let v = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = this._v - step; else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = this._v + step;
      else if (e.key === 'Home') v = this.min; else if (e.key === 'End') v = this.max; else return;
      e.preventDefault(); if (put(v)) emit('change');
    });
  }
  get min() { return this.hasAttribute('min') ? +this.getAttribute('min') : 0; }
  get max() { return this.hasAttribute('max') ? +this.getAttribute('max') : 100; }
  get step() { return this.hasAttribute('step') ? +this.getAttribute('step') : 0; }
  // Where the fill starts and where a double-tap returns to.
  get origin() { return this.hasAttribute('origin') ? +this.getAttribute('origin') : (this.min < 0 && this.max > 0 ? 0 : this.min); }
  // Null when the slider has no natural resting point (size, height): double-tap then does nothing.
  get resetValue() { return this.hasAttribute('default') ? +this.getAttribute('default') : (this.min < 0 && this.max > 0 ? 0 : null); }
  get value() { return this._v ?? this.resetValue ?? this.min; }
  set value(v) {
    v = +v; if (!Number.isFinite(v)) return;
    if (this.step) v = Math.round(v / this.step) * this.step;
    this._v = Math.min(this.max, Math.max(this.min, v)); this._paint();
  }
  _paint() {
    if (!this._built) return;
    const span = this.max - this.min || 1, k = (this._v - this.min) / span, o = (Math.min(this.max, Math.max(this.min, this.origin)) - this.min) / span;
    const at = (r) => `calc(${PAD}px + ${r.toFixed(4)} * (100% - ${2 * PAD}px))`;
    const fill = this.querySelector('.sl-fill');
    fill.style.left = at(Math.min(k, o)); fill.style.right = `calc(100% - ${at(Math.max(k, o))})`;
    this.querySelector('.sl-thumb').style.left = at(k);
    this.setAttribute('aria-valuemin', this.min); this.setAttribute('aria-valuemax', this.max); this.setAttribute('aria-valuenow', Math.round(this._v * 100) / 100);
  }
}
if (!customElements.get('ink-slider')) customElements.define('ink-slider', InkSlider);
