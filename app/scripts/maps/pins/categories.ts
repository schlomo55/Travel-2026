/* OPENSTREETMAP'S TAGS → THE MAP TAB'S CATEGORY (icon, colour, filter chip).

   The generic rule of the first trip's category table (Map 5a): only the tags
   of a PIN — the answer the coordinate pass found to BE the place — say what
   the place is for; the trip's own words and the entity's own kind decide
   everywhere else. Pure, no lookups. */
import type { PlaceCategory } from '../../../src/lib/model/types';

/* Rule 2 — OSM class=type → category. The brief's table (MAP-5A.md), with
   the classes it implies spelled out: aerialways, ferry terminals and bus
   stations move you; a bakery or a tea shop is somewhere you eat, so the food
   shops are food and every other shop is shopping. Anything not listed (a
   road, a building, a boundary, a pier) says nothing, and the kind decides. */
const FOOD_SHOPS = ['bakery', 'pastry', 'confectionery', 'deli', 'tea', 'coffee', 'dairy', 'seafood', 'food'];

export function categoryFromOsm(osmClass: string): PlaceCategory | null {
  const [cls = '', type = ''] = osmClass.split('=');
  if (cls === 'amenity' && ['restaurant', 'cafe', 'fast_food', 'food_court', 'bar', 'pub', 'biergarten', 'ice_cream'].includes(type)) return 'food';
  if (cls === 'shop' && FOOD_SHOPS.includes(type)) return 'food';
  if ((cls === 'leisure' && ['spa', 'sauna'].includes(type)) || (cls === 'amenity' && type === 'public_bath') || (cls === 'natural' && type === 'hot_spring') || (cls === 'shop' && type === 'massage')) return 'spa';
  if (cls === 'amenity' && ['theatre', 'arts_centre', 'concert_hall'].includes(type)) return 'show';
  if (cls === 'tourism' && ['hotel', 'guest_house', 'hostel', 'motel'].includes(type)) return 'hotel';
  if (['railway', 'aeroway', 'public_transport', 'aerialway'].includes(cls) || (cls === 'amenity' && ['ferry_terminal', 'bus_station'].includes(type))) return 'transport';
  if (cls === 'amenity' && ['hospital', 'clinic', 'pharmacy', 'doctors'].includes(type)) return 'medical';
  if (cls === 'healthcare') return 'medical';
  if (cls === 'shop' || (cls === 'amenity' && type === 'marketplace')) return 'shopping';
  if ((cls === 'tourism' && ['attraction', 'museum', 'viewpoint', 'gallery', 'zoo', 'theme_park', 'artwork'].includes(type)) || cls === 'historic' || (cls === 'leisure' && ['park', 'garden', 'nature_reserve'].includes(type)) || cls === 'natural') return 'sight';
  if (cls === 'amenity' && type === 'place_of_worship') return 'sight';
  return null;
}
