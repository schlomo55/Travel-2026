/* A FOCUSED ITEM IN A SIDEWAYS SCROLLER IS SHOWN WHOLE (Horizon Run 4).
   Chrome counts an element that is half past a scroll box's edge as visible,
   and does not scroll a focused one any further: a keyboard reached Now's
   VISA tile with most of the tile, and of its focus ring, outside the rail.
   `use:revealFocus` on the scroller brings whatever takes keyboard focus in
   it fully into view — at once, never a glide, so Calm motion and
   reduce-motion have nothing to switch off — stopping at the scroller's own
   scroll-padding, so the ring clears the edge. An item already wholly in
   view is left where it is; a snapping row (Now's tiles) is brought to the
   item's own snap position, or the snap would pull it back. Only keyboard
   focus (:focus-visible): a tap never moves the row under the thumb. */
import type { Action } from 'svelte/action';

export const revealFocus: Action<HTMLElement> = (node) => {
  const onFocus = (e: FocusEvent): void => {
    const t = e.target;
    if (!(t instanceof HTMLElement) || t === node || !t.matches(':focus-visible')) return;
    const box = node.getBoundingClientRect();
    const it = t.getBoundingClientRect();
    const s = getComputedStyle(node);
    const padL = parseFloat(s.scrollPaddingLeft) || 0;
    const padR = parseFloat(s.scrollPaddingRight) || 0;
    if (it.left >= box.left + padL && it.right <= box.right - padR) return;
    const snap = getComputedStyle(t).scrollSnapAlign.split(' ').pop();
    const inline: ScrollLogicalPosition = snap === 'start' || snap === 'center' || snap === 'end' ? snap : 'nearest';
    t.scrollIntoView({ block: 'nearest', inline });
  };
  node.addEventListener('focusin', onFocus);
  return {
    destroy() {
      node.removeEventListener('focusin', onFocus);
    },
  };
};
