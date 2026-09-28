/* THE GUIDE'S PROSE, AS MARKUP — the long read prints hundreds of lines of
   the trip file's own md-lite, and each line as a component would cost the
   app more script than the words themselves. So the prose is set here, once,
   as a string: every piece of trip text goes through renderMdlite, which
   escapes before it formats (the one {@html} rule, lib/components/ui/Md), and
   a label that is plain text goes through escapeHtml. Nothing here reads the
   DOM or stores anything. */
import type { ContentBlock, Spot } from '../../model/types';
import { escapeHtml, flagVerify, renderMdlite } from '../../logic/mdlite';
import { parseOption } from '../../logic/options';
import { fallbackOf, paragraphs } from '../../logic/guide';
import { iconSvg } from '../horizon/Icon.svelte';

/** md-lite → safe HTML; `verify` sets the file's own *(verify …)* marker as
    a flag, so the honesty note reads as a note and not as an aside. */
export function mdHtml(text: string, verify = false): string {
  return verify ? flagVerify(renderMdlite(text)) : renderMdlite(text);
}

const para = (t: string): string => (t ? `<p class="gd-p">${mdHtml(t, true)}</p>` : '');

/** A block's lines and its dated rows, as the guide sets them. In a
    Getting-there block (`there`) a line's "fallback(s):" clause is set as
    its own amber callout — the file's words, the file's order
    (logic/guide fallbackOf). */
export function proseHtml(b: ContentBlock, there = false): string {
  return (
    b.items
      .map((it) => {
        const f = there ? fallbackOf(it) : null;
        return f
          ? `${para(f.before)}<div class="gd-fall" role="note"><span class="caps">${escapeHtml(f.label)}</span><span>${mdHtml(f.text, true)}</span></div>${para(f.after)}`
          : para(it);
      })
      .join('') +
    (b.dayRows ?? []).map((r) => `<p class="gd-drow"><b class="num">${escapeHtml(r.label)}</b><span>${mdHtml(r.text, true)}</span></p>`).join('')
  );
}

/** The story: its paragraphs, the first with the drop cap, and the pull
    quote after it (aria-hidden — it repeats the story's own words). */
export function storyHtml(detail: string | undefined, quote: string | null): string {
  return paragraphs(detail)
    .map(
      (p, i) =>
        `<p class="gd-story${i ? '' : ' lead'}">${mdHtml(p, true)}</p>` +
        (i === 0 && quote ? `<figure class="gd-quote" aria-hidden="true"><span>“</span><blockquote>${escapeHtml(quote)}</blockquote></figure>` : ''),
    )
    .join('');
}

/* the three marks an option line wears: Icon's own glyphs, as markup */
const STAR = iconSvg('star');
const FORK = iconSvg('utensils');
const NEXT = iconSvg('arrow-right');

/** An option block (Our picks, More options, Where to eat…): each line with
    its star when the file marks it recommended, its name in bold, and — on
    a food list — the price the line quotes, at the right. */
export function optionsHtml(b: ContentBlock, spots: Spot[]): string {
  const eat = /eat|food|drink/i.test(b.heading);
  return b.items
    .map((it, i) => {
      const o = parseOption(it, b.id, i, b.heading, spots);
      const mark = o.star ? STAR : eat ? FORK : NEXT;
      const cost = o.cost && eat ? `<span class="num go-cost">${escapeHtml(o.cost)}</span>` : '';
      return `<li${o.star ? ' class="star"' : ''}>${mark}<span><b>${mdHtml(o.name)}</b>${o.detail ? ` — ${mdHtml(o.detail, true)}` : ''}</span>${cost}</li>`;
    })
    .join('');
}
