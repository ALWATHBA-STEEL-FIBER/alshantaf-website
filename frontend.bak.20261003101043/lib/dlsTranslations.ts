// Standard English names for Jordan's 12 governorates and their DLS land
// directorates, keyed by the exact Arabic label from the scraped dataset.
// The underlying form value stays the Arabic label regardless of site
// language (so admin search/dedup always compares the same canonical text) —
// this map only swaps the *displayed* text when browsing in English.
//
// Villages, basins and neighborhoods run into the thousands and are left in
// Arabic: hand-translating that many official place/parcel names isn't
// something that can be done reliably, and a wrong transliteration on a
// government land record is worse than showing the original Arabic.

export const GOVERNORATE_EN: Record<string, string> = {
  "محافظة العاصمة": "Amman Governorate",
  "محافظة اربد": "Irbid Governorate",
  "محافظة الزرقاء": "Zarqa Governorate",
  "محافظة البلقاء": "Balqa Governorate",
  "محافظة المفرق": "Mafraq Governorate",
  "محافظة الكرك": "Karak Governorate",
  "محافظة الطفيلة": "Tafilah Governorate",
  "محافظة معان": "Ma'an Governorate",
  "محافظة مادبا": "Madaba Governorate",
  "محافظة جرش": "Jerash Governorate",
  "محافظة عجلون": "Ajloun Governorate",
  "محافظة العقبة": "Aqaba Governorate",
};

export const DIRECTORATE_EN: Record<string, string> = {
  "اراضي عمان": "Amman Land Directorate",
  "اراضي غرب عمان": "West Amman Land Directorate",
  "اراضي شمال عمان": "North Amman Land Directorate",
  "اراضي شرق عمان": "East Amman Land Directorate",
  "اراضي جنوب عمان": "South Amman Land Directorate",
  "اراضي ناعور": "Na'our Land Directorate",
  "اراضي الموقر": "Muwaqqar Land Directorate",
  "اراضي اربد": "Irbid Land Directorate",
  "اراضي الرمثا": "Ramtha Land Directorate",
  "اراضي دير ابي سعيد": "Deir Abi Said Land Directorate",
  "اراضي الشونة الشمالية": "North Shuna Land Directorate",
  "اراضي بني كنانة": "Bani Kinanah Land Directorate",
  "اراضي الطيبه": "Taybeh Land Directorate",
  "اراضي المزار الشمالي": "North Mazar Land Directorate",
  "اراضي محافظة الزرقاء": "Zarqa Governorate Land Directorate",
  "اراضي السلط": "Salt Land Directorate",
  "اراضي الشونة الجنوبية": "South Shuna Land Directorate",
  "اراضي دير علا": "Deir Alla Land Directorate",
  "اراضي المفرق": "Mafraq Land Directorate",
  "اراضي البادية الشمالية": "Northern Badia Land Directorate",
  "اراضي الكرك": "Karak Land Directorate",
  "اراضي المزار الجنوبي": "South Mazar Land Directorate",
  "اراضي الأغوار الجنوبية": "South Ghor Land Directorate",
  "اراضي القصر": "Qasr Land Directorate",
  "اراضي الطفيله": "Tafilah Land Directorate",
  "اراضي بصيرا": "Bsaira Land Directorate",
  "اراضي الشوبك": "Shoubak Land Directorate",
  "اراضي وادي موسى": "Wadi Musa Land Directorate",
  "اراضي معان": "Ma'an Land Directorate",
  "اراضي مادبا": "Madaba Land Directorate",
  "اراضي ذيبان": "Dhiban Land Directorate",
  "اراضي جرش": "Jerash Land Directorate",
  "اراضي عجلون": "Ajloun Land Directorate",
  "اراضي العقبه": "Aqaba Land Directorate",
};

/** Derived from the two verified maps above (stripping "محافظة"/"اراضي" and the
 * "Governorate"/"Land Directorate" suffix) — these bare town/city names also
 * commonly recur as DLS *village* names, so checking this before falling back
 * to raw transliteration fixes the most visible cases (e.g. a village literally
 * named "عمان" showing as "Amman" instead of a mangled phonetic guess). */
export const COMMON_PLACE_EN: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(GOVERNORATE_EN).map(([ar, en]) => [ar.replace(/^محافظة\s*/, ""), en.replace(/\s*Governorate$/, "")])
  ),
  ...Object.fromEntries(
    Object.entries(DIRECTORATE_EN).map(([ar, en]) => [ar.replace(/^اراضي\s*/, ""), en.replace(/\s*Land Directorate$/, "")])
  ),
  // A handful of well-known industrial-zone village names (same English
  // spellings already used verbatim in the homepage areas guide copy).
  "سحاب": "Sahab",
  "القسطل": "Al-Qastal",
  "المشتى": "Al-Mushta",
  "الموقر": "Al-Muwaqqar",
  "البيادر": "Al-Bayader",
  "رجم الشامي": "Rujm Al-Shami",
  "الجيزة": "Al-Jizah",
  "القنيطرة": "Al-Qunaytirah",
  "الذهبية": "Al-Dhahabiyah",
  "الزرقاء": "Zarqa",
  "الضليل": "Al-Dulail",
  "الرجيب": "Al-Rajeeb",
  "العقبة": "Aqaba",
  "السلط": "Al-Salt",
  "إربد": "Irbid",
  "اربد": "Irbid",
  "المفرق": "Mafraq",
  "الكرك": "Karak",
  "معان": "Ma'an",
};
