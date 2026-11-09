/* NO MANDARIN PINYIN ON A CANTONESE CARD (QA 9 Nov 2026). The Hong Kong
   police phrase, in Traditional characters, showed Mandarin pinyin. */
import { describe, expect, it } from 'vitest';
import { cardRomanisation } from '../lib/logic/pass';

describe('card romanisation', () => {
  it('a Simplified mainland card shows its pinyin as written', () => {
    expect(cardRomanisation({ pinyin: 'nǐ hǎo' })).toBe('nǐ hǎo');
    expect(cardRomanisation({ pinyin: 'nǐ hǎo', script: 'Hans' })).toBe('nǐ hǎo');
  });
  it('a Traditional or HK/Macau card hides Mandarin pinyin', () => {
    expect(cardRomanisation({ pinyin: 'qǐng bāng wǒ', script: 'Hant' })).toBeNull();
    expect(cardRomanisation({ pinyin: 'qǐng bāng wǒ', region: 'HK' })).toBeNull();
    expect(cardRomanisation({ pinyin: 'qǐng bāng wǒ', region: 'mo' })).toBeNull();
  });
  it('keeps only the part the trip file marks as Cantonese', () => {
    expect(cardRomanisation({ pinyin: 'qǐng bāng wǒ · Cantonese 999 = gau2 gau2 gau2', script: 'Hant', region: 'HK' })).toBe(
      'Cantonese 999 = gau2 gau2 gau2',
    );
  });
  it('no pinyin, nothing', () => {
    expect(cardRomanisation({})).toBeNull();
  });
});
