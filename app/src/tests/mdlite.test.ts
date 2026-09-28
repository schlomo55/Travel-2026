import { describe, expect, it } from 'vitest';
import { escapeHtml, flagVerify, htmlToMdlite, mdliteToText, renderMdlite } from '../lib/logic/mdlite';

describe('renderMdlite', () => {
  it('escapes everything first — imported content can never inject markup', () => {
    expect(renderMdlite('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(renderMdlite('a & b')).toBe('a &amp; b');
  });

  it('renders bold, italic, links and newlines', () => {
    expect(renderMdlite('**20 kg** cap')).toBe('<b>20 kg</b> cap');
    expect(renderMdlite('go *slow* up there')).toBe('go <i>slow</i> up there');
    expect(renderMdlite('[Manage](https://x.example/y)')).toBe('<a href="https://x.example/y" target="_blank" rel="noopener">Manage</a>');
    expect(renderMdlite('a\nb')).toBe('a<br>b');
  });

  it('only linkifies http(s) urls', () => {
    expect(renderMdlite('[x](javascript:alert(1))')).not.toContain('<a');
  });

  it('leaves prices and asterisk-free text alone', () => {
    expect(renderMdlite('plan ≈ $6,500 total (±10%)')).toBe('plan ≈ $6,500 total (±10%)');
  });
});

describe('htmlToMdlite (seed conversion of legacy inline HTML)', () => {
  it('converts the legacy patterns', () => {
    expect(htmlToMdlite('<b>Etihad EY608 + EY888</b> · TLV 14:00')).toBe('**Etihad EY608 + EY888** · TLV 14:00');
    expect(htmlToMdlite('see <a href="https://racing.hkjc.com" target="_blank">fixtures</a> now')).toBe(
      'see [fixtures](https://racing.hkjc.com) now',
    );
    expect(htmlToMdlite('Powder &amp; the South')).toBe('Powder & the South');
    expect(htmlToMdlite('arrive 08:45<sup>+1</sup>')).toBe('arrive 08:45+1');
    expect(htmlToMdlite('line one<br>line two')).toBe('line one\nline two');
  });

  it('strips unknown tags but keeps their text', () => {
    expect(htmlToMdlite('<span class="x">kept</span>')).toBe('kept');
  });

  it('round-trips through the renderer safely', () => {
    const mdlite = htmlToMdlite('<b>PEK (Capital), not Daxing</b> — fog-prone');
    expect(renderMdlite(mdlite)).toBe('<b>PEK (Capital), not Daxing</b> — fog-prone');
  });
});

describe('mdliteToText', () => {
  it('projects to plain text for titles/ics/csv', () => {
    expect(mdliteToText('**Book trains** via [Trip.com](https://www.trip.com/trains/)')).toBe('Book trains via Trip.com');
  });
});

describe('escapeHtml', () => {
  it('escapes the four dangerous characters', () => {
    expect(escapeHtml(`<a b="c">&`)).toBe('&lt;a b=&quot;c&quot;&gt;&amp;');
  });
});

describe('flagVerify — the trip file’s own verify marker, set as a flag', () => {
  it('sets *verify* and *(verify …)* as a flag, and nothing else', () => {
    expect(flagVerify(renderMdlite('now 07:45 *verify* · CA9659'))).toBe('now 07:45 <span class="md-vfy">verify</span> · CA9659');
    expect(flagVerify(renderMdlite('covers days *(verify the validity)*'))).toBe('covers days <span class="md-vfy">(verify the validity)</span>');
    expect(flagVerify(renderMdlite('*Avatar* borrowed'))).toBe('<i>Avatar</i> borrowed');
  });
});
