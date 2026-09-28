// Best-effort Arabic → Latin transliteration for the thousands of DLS
// village/basin/neighborhood names, which are too many to hand-translate
// reliably (unlike the 12 governorates and 34 directorates in
// dlsTranslations.ts, which have real, verified English names).
//
// This is a phonetic romanization, not an official translation — it exists so
// English-mode users see something readable instead of raw Arabic script. The
// canonical, legally-meaningful value stored on the form is always the
// original Arabic label; this only changes what's *displayed*.

const LETTER_MAP: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ء": "'",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh",
  "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "'", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l",
  "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y",
  "ة": "ah", "ى": "a", "ئ": "e", "ؤ": "o",
  "َ": "", "ُ": "", "ِ": "", "ّ": "", "ْ": "", "ً": "", "ٌ": "", "ٍ": "",
};

function transliterateWord(word: string): string {
  let out = "";
  for (const ch of word) out += LETTER_MAP[ch] ?? ch;
  return out;
}

function capitalize(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Transliterates one Arabic place-name label, preserving any "(N)" numeric
 * suffix/prefix (basin/neighborhood numbers) untouched and rendering the "ال"
 * definite article as "Al-" per common Jordanian place-name convention. */
export function transliterate(label: string): string {
  const prefixMatch = label.match(/^\((\d+)\)\s*(.*)$/);
  if (prefixMatch) {
    return `(${prefixMatch[1]}) ${transliterateName(prefixMatch[2].trim())}`;
  }
  const suffixMatch = label.match(/^(.*?)\((\d+)\)\s*$/);
  if (suffixMatch) {
    return `${transliterateName(suffixMatch[1].trim())} (${suffixMatch[2]})`;
  }
  return transliterateName(label);
}

function transliterateName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.startsWith("ال") && word.length > 2) {
        return `Al-${capitalize(transliterateWord(word.slice(2)))}`;
      }
      return capitalize(transliterateWord(word));
    })
    .join(" ");
}
