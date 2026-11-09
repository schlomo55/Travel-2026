/* "DETAILS ▸" (QA 9 Nov 2026): a long text shows its short version, the rest
   folded under a toggle. The data convention is one line, `--- details ---`;
   the plain-text projection (titles, search, CSV, .ics) drops the line and
   keeps every word. */
import { describe, expect, it } from 'vitest';
import { mdliteToText, renderMdlite } from '../lib/logic/mdlite';

describe('md-lite fold', () => {
  it('folds what follows the line under a Details toggle', () => {
    const html = renderMdlite('Pickup **15:00** at the inn\n--- details ---\nThe driver waits at gate 2.\nCash only.');
    expect(html).toBe('Pickup <b>15:00</b> at the inn<details class="md-more"><summary>Details</summary>The driver waits at gate 2.<br>Cash only.</details>');
  });
  it('any case, spaces optional; an empty fold folds nothing', () => {
    expect(renderMdlite('a\n---Details---\nb')).toContain('<summary>Details</summary>b');
    expect(renderMdlite('a\n--- details ---\n  ')).toBe('a');
  });
  it('the fold is escaped like everything else', () => {
    expect(renderMdlite('a\n--- details ---\n<script>')).toContain('&lt;script&gt;');
  });
  it('text without the line is unchanged; a dash rule is not a fold', () => {
    expect(renderMdlite('a\n---\nb')).toBe('a<br>---<br>b');
  });
  it('the plain text keeps every word and drops the line', () => {
    expect(mdliteToText('short\n--- details ---\nlong')).toBe('short\nlong');
  });
});
