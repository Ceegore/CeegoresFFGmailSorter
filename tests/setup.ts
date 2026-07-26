// Vitest setup: jsdom returns 0x0 bounding rects for all elements, but the
// spec's interactability check (§13.5) requires width/height > 2px. We make
// connected elements report a visible rect so controller logic can be
// exercised. Production runs in real Firefox where rects are real.
const VISIBLE_RECT: DOMRect = {
  width: 10,
  height: 10,
  top: 0,
  left: 0,
  right: 10,
  bottom: 10,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};
const HIDDEN_RECT: DOMRect = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  configurable: true,
  writable: true,
  value: function getBoundingClientRect(this: Element): DOMRect {
    return this.isConnected ? VISIBLE_RECT : HIDDEN_RECT;
  },
});
