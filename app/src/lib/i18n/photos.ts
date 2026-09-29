/* THE PLACES' PHOTOS, IN WORDS (Map 5e; a module of its own since Map 5f) — what the photos, the About, the links
   and the credits say. Only the Map tab and Settings read them, and both are lazy screens: kept in strings.ts's `S`
   they sat in the start-up bundle, which every cold start loads and parses (docs/design/HORIZON.md §7–8). Every
   other string of the app is in strings.ts. */
export const SP = {
  alt: (name: string) => `Photo of ${name}`,
  /** the place card's photo is a button: it opens full screen */
  expand: (name: string) => `Show the photo of ${name} full screen`,
  noPhoto: 'No free photo of this place',
  about: 'About',
  fromWikipedia: 'From Wikipedia',
  /** under the About: the licence of Wikipedia's words */
  textCredit: (licence: string) => `Text · ${licence}`,
  wikipedia: 'Wikipedia',
  official: 'Official site',
  amap: 'Amap',
  /** said quietly under the links: they are the only things here that go online */
  linksNote: 'Links open outside the app and need internet — Wikipedia and Google in mainland China only with a VPN or a roaming eSIM.',
  linkAria: (what: string, name: string) => `${what}: ${name}, opens outside the app`,
  lookFor: 'Look for this',
  lookForAria: (name: string) => `Look for this: the photo of ${name}, full screen`,
  /* the full-screen view */
  viewerAria: (name: string) => `Photo of ${name}`,
  close: 'Close the photo',
  filePage: (site: string) => `File page on ${site}`,
  changed: 'Resized and cropped for this app.',
  /* Settings › Photo credits */
  credits: 'Photo credits',
  creditsLine: (n: number) => `${n === 1 ? '1 photo' : `${n} photos`} · who took each one, and its licence`,
  creditsNone: 'The map pack on this phone carries no photos.',
  creditsIntro:
    'The photos of your places come from Wikimedia Commons and other free libraries, each under its own free licence, resized and cropped for this app. The About texts are Wikipedia’s own words, under CC BY-SA 4.0. The links need internet.',
  licences: 'The licences',
  /** how many of the pack's photos and About texts a licence covers (Map 5f: the texts' licence is linked too) */
  licenceCount: (photos: number, texts = 0) =>
    [photos ? (photos === 1 ? '1 photo' : `${photos} photos`) : '', texts ? (texts === 1 ? '1 text' : `${texts} texts`) : ''].filter(Boolean).join(' · '),
  photoBy: (author: string, licence: string) => (author ? `${author} · ${licence}` : licence),
  /** a photo whose library gave it no title (the credit then names the photo by where it lives, never by an id) */
  untitled: (site: string) => `A photo on ${site}`,
  sourceAria: (name: string, site: string) => `The photo of ${name} on ${site}`,
  textAria: (title: string) => `The Wikipedia article ${title}`,
  textBy: (title: string, licence: string) => `Text: Wikipedia, “${title}” · ${licence}`,
};
