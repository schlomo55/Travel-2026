# ROUND 5b — THE MAP TAB, CHOSEN DIRECTION: "Street map + radar + navigate" (Horizon, DARK ONLY)

Owner: "I like the idea of the radar but I want a map, for example like Google Maps, with the points, and for me to
be able to navigate with it to the points, and some short detail about the place or the kind of it — hotel, spa, food."
Read MAPS5.md (data truth, Dec 8 Beijing moment, real distances, nav with 4 places) and HORIZON.md. Build on the
look of `project/map2-atlas.dc.html` (street map) and `project/map1-radar.dc.html` (rings, instrument feel).

## The design (4 boards, 412×915, files map4-*.dc.html, prototype-linked)
1. **map4-map** — the Map tab: a full-screen night street map (Horizon colours; streets, water, parks; clearly an
   illustration of offline OpenStreetMap data — caption "Illustration · real data: OpenStreetMap, stored on this phone").
   YOU = sunrise dot with a heading cone + accuracy halo, and the RADAR idea carried over: faint distance rings around
   you (250 m · 500 m · 1 km) with tiny Martian Mono labels, toggle button "Rings". Typed pins (category icons + colours
   below) with a cluster ("+4"). Top: a search field "Find a place" + category chips with counts (All · Food · Spa ·
   Sights · Hotels · Transport · Medical). Bottom sheet at peek: "Near you" — a horizontal rail of place cards, nearest
   first, each: icon + category word, name + Chinese, ONE short real detail line, straight-line distance when known, and
   a Navigate button.
2. **map4-place** — a pin tapped → the place sheet for **Beijing Massage Hospital 北京按摩医院** (real coords: ≈ 1.9 km
   WSW of you): category **Spa · massage**, detail "Blind massage / tuina — not bone-setting" (the card's own words),
   "Today: spa day" context chip, distance + bearing arrow, a small radar inset, buttons: **Navigate** (primary) ·
   Driver card · Open in Google Maps · Copy address · Add to my day.
3. **map4-go** — **Guide me (works offline)**: the map zoomed to fit you + the target, a glowing direction line from you
   to it (FLOW motion — the live leg), a large compass arrow card "1.9 km · WSW" that turns as you walk, "straight
   line — follow streets on the map", and two buttons: "Turn-by-turn in Amap" (works in mainland China without a VPN)
   · "Google Maps". A quiet line: "Directions open in the maps app; this app never goes online for maps."
4. **map4-filters** — the category sheet / legend: every category with its icon, colour and count for Beijing, a
   "Show on map" toggle each, and "Hotels: your beds only / all" option. Counts: use MAPS5.md's Beijing lists; spa =
   Jiuhua Resort hot springs, Chunhuiyuan hot springs, Beijing Massage Hospital; hotels = Four Points (5–7 Dec, done) and
   Blossom House (7–9 Dec, tonight); medical = Huguosi TCM Hospital.

## Category icon set (24×24, stroke 1.8; colours from Horizon; status colours stay reserved for bookings)
- **Food** bowl `<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M6 19h12"/><path d="m14 3-4 7"/><path d="m18 3-4 7"/>` — #FF7EB6
- **Spa** droplet `<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9Z"/><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5"/>` — #7FE3F0
- **Sight** mountain `<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>` — #FF9F6B
- **Show** ticket (MAPS5 path) — #B69CFF
- **Hotel** bed (MAPS5 path) — #F4F2FA; TONIGHT's bed gets a sunrise ring + "Tonight" label
- **Transport** train / plane (MAPS5 paths) — #B4B3C8
- **Medical** cross (MAPS5 path) — #F4F2FA on a white-ringed disc
- **Shopping** bag `<path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>` — #FFB38A
Pin = 34px disc (fill #1D2035) + 1.5px ring + 18px icon in the category colour; selected = filled colour, dark icon,
label bubble. YOU = the only sunrise-filled dot.

## Real one-line details (use exactly; never invent)
- Siji Minfu 四季民福 (Food · Peking duck): "The Peking duck locals name, five minutes from the Forbidden City's east exit. Whole duck ¥168–228."
- Yaoji Chaogan 姚记炒肝 (Food · breakfast): "One of the last places doing the real Beijing breakfast stew — minutes from Blossom House."
- Dong Lai Shun 东来顺 (Food · hotpot): "Copper-pot mutton hotpot since 1903, the Beijing winter meal."
- Beijing Massage Hospital 北京按摩医院 (Spa · massage): "Blind massage / tuina — not bone-setting." (≈ 1.9 km WSW)
- Huguosi TCM Hospital 护国寺中医医院 (Medical · bone-setting): "骨伤科 bone-setting, your Dec 8 morning — a 10–15 min walk from Blossom House." (≈ 1.6 km W)
- Jiuhua Resort 九华山庄 (Spa · hot springs): "All-day hot springs, ~1 h north, ¥138 day pass, 70+ pools — ring ahead."
- Shichahai / Houhai lakes 什刹海 (Sight): "Willow-lined hutong lakesides, free."
- Beihai Park 北海公园 (Sight): "The White Dagoba above a frozen lake, ten minutes on foot from Jingshan."
- Lama Temple 雍和宫 (Sight): "18 m sandalwood Buddha, walkable from the hutongs; winter hours to 16:30."
- Lao She Teahouse 老舍茶馆 (Show): "90-min variety night: opera, acrobatics, face-changing, kung fu + snacks, ¥180–580."
- Blossom House, Prince Kung's Mansion (Hotel · tonight): "Your bed 7–9 Dec — booked."
Only Beijing Massage Hospital, Huguosi TCM Hospital, Houhai, Sanlitun, Beijing South, PEK and PKX have REAL coordinates
(MAPS5.md table). Pins for the others appear only after the coordinate pass — on the illustration you may place them
schematically, but show real distances ONLY for the seven real ones (others: no distance, or "after the coordinate pass").
