/* The curated place photos: hand-picked from Wikimedia Commons to match the
   season of the visit (late November – December), pre-optimized on the PC by
   scripts/fetch-photos.ts and COMMITTED to sources/china-2026/images/ — the
   seed build never touches the network, so rebuilds stay byte-identical.
   Full attribution lives in sources/china-2026/images/CREDITS.md. */

export interface PlacePhoto {
  /** Legacy stop key — the optimized file is images/<stopKey>.webp. */
  stopKey: string;
  commonsTitle: string;
  author: string;
  license: string;
}

export const PLACE_PHOTOS: PlacePhoto[] = [
  { stopKey: 'kunyu', commonsTitle: 'File:Kunyu Mountains, China.jpg', author: 'Mguy379', license: 'CC BY-SA 3.0' },
  {
    stopKey: 'beijing',
    commonsTitle: 'File:Forbidden City after snow (20200106114634).jpg',
    author: 'N509FZ',
    license: 'CC BY-SA 4.0',
  },
  { stopKey: 'chongli', commonsTitle: 'File:万龙雪场 - panoramio.jpg', author: '黑夜有灯', license: 'CC BY 3.0' },
  {
    stopKey: 'zhangjiajie',
    commonsTitle: 'File:1 tianzishan wulingyuan zhangjiajie 2012.jpg',
    author: 'chensiyuan',
    license: 'CC BY-SA 4.0',
  },
  {
    stopKey: 'chongqing',
    commonsTitle: 'File:20250521 Hongyadong (223429).jpg',
    author: 'Yumeto',
    license: 'CC BY-SA 4.0',
  },
  {
    stopKey: 'lijiang',
    commonsTitle: 'File:1 lijiang old town night.jpg',
    author: 'chensiyuan',
    license: 'CC BY-SA 4.0',
  },
  {
    stopKey: 'gorge',
    commonsTitle: 'File:Yunnan China Tiger-Leaping-Gorge-04.jpg',
    author: 'CEphoto, Uwe Aranas',
    license: 'CC BY-SA 3.0',
  },
  {
    stopKey: 'dali',
    commonsTitle: 'File:20260223 Three Pagodas of Chongsheng Temple, Dali, Yunnan.jpg',
    author: 'Ngguls',
    license: 'CC BY-SA 4.0',
  },
  { stopKey: 'kunming', commonsTitle: 'File:Gulls in Cuihu.jpg', author: 'RoyalCathayan', license: 'CC BY-SA 4.0' },
  {
    stopKey: 'hongkong',
    commonsTitle: 'File:Hong Kong Harbour Night 2019-06-11.jpg',
    author: 'Benh LIEU SONG',
    license: 'CC BY-SA 4.0',
  },
];

/** The shelf cover reuses this stop's photo (no extra file). */
export const COVER_STOP_KEY = 'beijing';
