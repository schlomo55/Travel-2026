/* IS THE ON-SCREEN KEYBOARD UP? — from the window's height alone.

   Android's Back closes the keyboard but leaves the focus in the field, so a
   rule keyed on the focus (NavBar.svelte hides the bar while a field is
   focused) keeps the bar hidden until the person taps blank space. The window
   knows better: the keyboard is the part of the screen the page lost, and a
   WebView or a browser that resizes for it reports it the same way. The page
   is the tallest it has been when the keyboard is down; it is up when the page
   has lost a real slice of that. A URL bar sliding away costs ~50 px and a
   keyboard 250 or more, so the bar is 120 px or 15 % of the page, whichever is
   larger. Pure: heights in, answer out (tests/keyboard.test.ts). */

/** `full` — the tallest the page has been; `now` — its height now (px). */
export function keyboardOpen(full: number, now: number): boolean {
  return full > 0 && full - now > Math.max(120, full * 0.15);
}

export interface KeyboardWatch {
  /** the tallest height seen */
  full: number;
  open: boolean;
}

/** One resize of the page. `closed` is true on the one step where the keyboard
    goes from up to down — the moment to let go of the field that kept the focus.
    Opening, typing and a keyboard that stays up are never `closed`. */
export function keyboardStep(w: KeyboardWatch, height: number): { w: KeyboardWatch; closed: boolean } {
  const full = Math.max(w.full, height);
  const open = keyboardOpen(full, height);
  return { w: { full, open }, closed: w.open && !open };
}
