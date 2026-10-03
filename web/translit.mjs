// Gujarati <-> English (Latin) for names and places, offline and instant.
// Used by the server (to store every name and place in BOTH scripts) and by
// the app (fallback for records saved before this existed). Common names,
// surnames and places come from a word list so they read the way people
// write them (Chudasama, Bhavnagar, સુરત); everything else is spelled out
// sound by sound. No network, no outside service.

const GU_RANGE = /[઀-૿]/;
export const hasGujarati = (s) => GU_RANGE.test(String(s || ""));
export const hasLatin = (s) => /[A-Za-z]/.test(String(s || ""));

// Words people actually write — [English, Gujarati]. Matched whole-word,
// case-insensitive, in both directions.
const WORDS = [
  // places
  ["Mahuva", "મહુવા"], ["Bhavnagar", "ભાવનગર"], ["Surat", "સુરત"], ["Ahmedabad", "અમદાવાદ"],
  ["Vadodara", "વડોદરા"], ["Baroda", "બરોડા"], ["Rajkot", "રાજકોટ"], ["Gandhinagar", "ગાંધીનગર"],
  ["Jamnagar", "જામનગર"], ["Junagadh", "જૂનાગઢ"], ["Amreli", "અમરેલી"], ["Botad", "બોટાદ"],
  ["Palitana", "પાલીતાણા"], ["Talaja", "તળાજા"], ["Rajula", "રાજુલા"], ["Una", "ઉના"],
  ["Savarkundla", "સાવરકુંડલા"], ["Ghogha", "ઘોઘા"], ["Sihor", "સિહોર"], ["Gariadhar", "ગારિયાધાર"],
  ["Jesar", "જેસર"], ["Umrala", "ઉમરાળા"], ["Vallabhipur", "વલ્લભીપુર"], ["Ghelo", "ઘેલો"],
  ["Mumbai", "મુંબઈ"], ["Bombay", "બોમ્બે"], ["Pune", "પુણે"], ["Delhi", "દિલ્હી"],
  ["Bengaluru", "બેંગલુરુ"], ["Bangalore", "બેંગલોર"], ["Hyderabad", "હૈદરાબાદ"], ["Chennai", "ચેન્નાઈ"],
  ["Kolkata", "કોલકાતા"], ["Anand", "આણંદ"], ["Nadiad", "નડિયાદ"], ["Bharuch", "ભરૂચ"],
  ["Ankleshwar", "અંકલેશ્વર"], ["Navsari", "નવસારી"], ["Valsad", "વલસાડ"], ["Vapi", "વાપી"],
  ["Mehsana", "મહેસાણા"], ["Morbi", "મોરબી"], ["Porbandar", "પોરબંદર"], ["Gondal", "ગોંડલ"],
  ["Jetpur", "જેતપુર"], ["Dhoraji", "ધોરાજી"], ["Kutch", "કચ્છ"], ["Bhuj", "ભુજ"],
  ["Gandhidham", "ગાંધીધામ"], ["Surendranagar", "સુરેન્દ્રનગર"], ["Veraval", "વેરાવળ"], ["Diu", "દીવ"],
  ["Gujarat", "ગુજરાત"], ["India", "ભારત"], ["Dubai", "દુબઈ"], ["London", "લંડન"],
  ["USA", "અમેરિકા"], ["America", "અમેરિકા"], ["Canada", "કેનેડા"], ["Australia", "ઓસ્ટ્રેલિયા"],
  ["Africa", "આફ્રિકા"], ["Kenya", "કેન્યા"], ["Nagar", "નગર"], ["Road", "રોડ"],
  ["Society", "સોસાયટી"], ["Station", "સ્ટેશન"], ["Village", "ગામ"], ["City", "શહેર"],
  ["Thorala", "થોરાળા"], ["Sathra", "સથરા"], ["Taredi", "તરેડી"], ["Lilvan", "લીલવણ"],
  // surnames
  ["Vala", "વાળા"], ["Chudasama", "ચુડાસમા"], ["Gohil", "ગોહિલ"], ["Jadeja", "જાડેજા"],
  ["Parmar", "પરમાર"], ["Zala", "ઝાલા"], ["Jhala", "ઝાલા"], ["Rathod", "રાઠોડ"], ["Solanki", "સોલંકી"],
  ["Vaghela", "વાઘેલા"], ["Sarvaiya", "સરવૈયા"], ["Chauhan", "ચૌહાણ"], ["Jethva", "જેઠવા"],
  ["Rana", "રાણા"], ["Sindhav", "સિંધવ"], ["Dabhi", "ડાભી"], ["Makwana", "મકવાણા"],
  ["Gohilvadiya", "ગોહિલવાડિયા"], ["Raol", "રાઓલ"], ["Sodha", "સોઢા"], ["Bhatti", "ભટ્ટી"],
  ["Patel", "પટેલ"], ["Shah", "શાહ"], ["Mehta", "મહેતા"], ["Joshi", "જોશી"], ["Desai", "દેસાઈ"],
  // name parts
  ["Sinh", "સિંહ"], ["Sinhji", "સિંહજી"], ["Bhai", "ભાઈ"], ["Ben", "બેન"], ["Ba", "બા"],
  ["Kumar", "કુમાર"], ["Kunvar", "કુંવર"], ["Kunwar", "કુંવર"], ["Kunvarba", "કુંવરબા"],
  ["Raj", "રાજ"], ["Dev", "દેવ"], ["Pal", "પાલ"], ["Dan", "દાન"],
  ["Mahendra", "મહેન્દ્ર"], ["Narendra", "નરેન્દ્ર"], ["Jitendra", "જીતેન્દ્ર"], ["Dharmendra", "ધર્મેન્દ્ર"],
  ["Pradip", "પ્રદીપ"], ["Pradeep", "પ્રદીપ"], ["Rajendra", "રાજેન્દ્ર"], ["Virendra", "વીરેન્દ્ર"],
  ["Yuvraj", "યુવરાજ"], ["Digvijay", "દિગ્વિજય"], ["Jaswant", "જસવંત"], ["Bhagirath", "ભગીરથ"],
  ["Kishor", "કિશોર"], ["Ramesh", "રમેશ"], ["Suresh", "સુરેશ"], ["Mahesh", "મહેશ"], ["Dinesh", "દિનેશ"],
  ["Jaldip", "જલદીપ"], ["Jaydeep", "જયદીપ"], ["Jaydip", "જયદીપ"], ["Kuldip", "કુલદીપ"], ["Kuldeep", "કુલદીપ"],
  ["Hardik", "હાર્દિક"], ["Harshad", "હર્ષદ"], ["Ajay", "અજય"], ["Vijay", "વિજય"], ["Sanjay", "સંજય"],
  ["Asha", "આશા"], ["Geeta", "ગીતા"], ["Gita", "ગીતા"], ["Sita", "સીતા"], ["Daksha", "દક્ષા"],
  ["Ekta", "એકતા"], ["Komal", "કોમલ"], ["Nisha", "નિશા"], ["Pooja", "પૂજા"], ["Puja", "પૂજા"],
  ["Ghanshyam", "ઘનશ્યામ"], ["Pravin", "પ્રવીણ"], ["Praveen", "પ્રવીણ"], ["Krishna", "કૃષ્ણ"], ["Ravindra", "રવીન્દ્ર"],
  ["Arjun", "અર્જુન"], ["Hitesh", "હિતેશ"], ["Manoj", "મનોજ"], ["Bharat", "ભરત"], ["Bhavesh", "ભાવેશ"],
  ["Nilesh", "નિલેશ"], ["Paresh", "પરેશ"], ["Rajesh", "રાજેશ"], ["Mukesh", "મુકેશ"], ["Naresh", "નરેશ"],
  ["Ashok", "અશોક"], ["Anil", "અનિલ"], ["Sunil", "સુનિલ"], ["Vikram", "વિક્રમ"], ["Ghanshyamsinh", "ઘનશ્યામસિંહ"],
  ["Pruthviraj", "પૃથ્વીરાજ"], ["Prithviraj", "પૃથ્વીરાજ"], ["Shaktisinh", "શક્તિસિંહ"], ["Bhavna", "ભાવના"],
  ["Hansa", "હંસા"], ["Kokila", "કોકિલા"], ["Meena", "મીના"], ["Rekha", "રેખા"], ["Usha", "ઉષા"], ["Jyoti", "જ્યોતિ"],
  // everyday words in addresses and test data
  ["Satellite", "સેટેલાઇટ"], ["Admin", "એડમિન"], ["Member", "મેમ્બર"], ["Main", "મુખ્ય"], ["Test", "ટેસ્ટ"],
  ["Directory", "ડિરેક્ટરી"], ["Colony", "કોલોની"], ["Park", "પાર્ક"], ["Street", "સ્ટ્રીટ"], ["Highway", "હાઇવે"],
  ["Near", "પાસે"], ["Opp", "સામે"], ["Opposite", "સામે"], ["Flat", "ફ્લેટ"], ["Apartment", "એપાર્ટમેન્ટ"],
  ["Bopal", "બોપલ"], ["Maninagar", "મણિનગર"], ["Vastrapur", "વસ્ત્રાપુર"], ["Varachha", "વરાછા"], ["Adajan", "અડાજણ"],
];
const EN2GU = new Map();
const GU2EN = new Map();
for (const [en, gu] of WORDS) {
  if (!EN2GU.has(en.toLowerCase())) EN2GU.set(en.toLowerCase(), gu);
  if (!GU2EN.has(gu)) GU2EN.set(gu, en);
}
// Endings that are written together with the name ("Jaswantsinh").
const SUFFIXES = ["sinhji", "sinh", "bhai", "kunvarba", "ben", "kumar", "ba"];

// ---------------------------------------------------------------- Gujarati → English
const CONS = {
  "ક": "k", "ખ": "kh", "ગ": "g", "ઘ": "gh", "ઙ": "n", "ચ": "ch", "છ": "chh", "જ": "j", "ઝ": "z", "ઞ": "n",
  "ટ": "t", "ઠ": "th", "ડ": "d", "ઢ": "dh", "ણ": "n", "ત": "t", "થ": "th", "દ": "d", "ધ": "dh", "ન": "n",
  "પ": "p", "ફ": "f", "બ": "b", "ભ": "bh", "મ": "m", "ય": "y", "ર": "r", "લ": "l", "ળ": "l", "વ": "v",
  "શ": "sh", "ષ": "sh", "સ": "s", "હ": "h",
};
const VOW = { "અ": "a", "આ": "a", "ઇ": "i", "ઈ": "i", "ઉ": "u", "ઊ": "u", "ઋ": "ru", "એ": "e", "ઐ": "ai", "ઓ": "o", "ઔ": "au", "ઍ": "e", "ઑ": "o" };
const MATRA = { "ા": "a", "િ": "i", "ી": "i", "ુ": "u", "ૂ": "u", "ૃ": "ru", "ે": "e", "ૈ": "ai", "ો": "o", "ૌ": "au", "ૅ": "e", "ૉ": "o" };
const VIRAMA = "્";
const NASAL = new Set(["ં", "ઁ"]);

function guWordToLatin(word) {
  if (GU2EN.has(word)) return GU2EN.get(word);
  // A known word + a known ending ("જસવંતસિંહ").
  for (const [gu, en] of GU2EN)
    if (word.length > gu.length && word.endsWith(gu) && SUFFIXES.includes(en.toLowerCase())) {
      const head = guWordToLatin(word.slice(0, -gu.length));
      return head + en.toLowerCase();
    }
  // Syllables: { c: consonant(s), v: vowel or null (inherent a), n: nasal, h: visarga, keep }
  const syl = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (CONS[ch]) {
      let c = CONS[ch];
      // conjuncts: consonant + virama + consonant ...
      while (chars[i + 1] === VIRAMA && CONS[chars[i + 2]]) {
        c += CONS[chars[i + 2]];
        i += 2;
      }
      if (chars[i + 1] === VIRAMA) {
        syl.push({ c, v: "", dead: true });
        i++;
        continue;
      }
      let v = null;
      if (MATRA[chars[i + 1]]) {
        v = MATRA[chars[i + 1]];
        i++;
      }
      const s = { c, v };
      if (NASAL.has(chars[i + 1])) {
        s.n = true;
        i++;
      }
      if (chars[i + 1] === "ઃ") {
        s.h = true;
        i++;
      }
      syl.push(s);
    } else if (VOW[ch]) {
      const s = { c: "", v: VOW[ch] };
      if (NASAL.has(chars[i + 1])) {
        s.n = true;
        i++;
      }
      syl.push(s);
    } else if (NASAL.has(ch) && syl.length) {
      syl[syl.length - 1].n = true;
    } else if (/[૦-૯]/.test(ch)) {
      syl.push({ raw: String("૦૧૨૩૪૫૬૭૮૯".indexOf(ch)) });
    } else {
      syl.push({ raw: ch });
    }
  }
  // Schwa deletion: the final inherent "a" is silent; a middle one is silent
  // between two sounded vowels (left to right, never two in a row).
  const last = syl.length - 1;
  if (last > 0 && syl[last].c && syl[last].v === null && !syl[last].n) syl[last].drop = true;
  for (let i = 1; i < last; i++) {
    const s = syl[i];
    if (!s.c || s.v !== null || s.n || s.h) continue;
    const prev = syl[i - 1];
    const next = syl[i + 1];
    const prevVoiced = prev && (prev.v !== undefined && !prev.drop && !prev.dead && !prev.raw);
    const nextVoiced = next && next.c !== undefined && !next.drop && !next.dead && !next.raw;
    if (prevVoiced && nextVoiced) s.drop = true;
  }
  let out = "";
  syl.forEach((s, i) => {
    if (s.raw !== undefined) return void (out += s.raw);
    let c = s.c;
    // "v" after a consonant cluster sounds like w (Jaswant, Ashwin).
    if (c === "v" && /[bcdfghjklmnpqrstxz]$/.test(out)) c = "w";
    out += c;
    if (s.dead) return;
    if (s.v === null) out += s.drop ? "" : "a";
    else out += s.v;
    if (s.n) {
      const next = syl[i + 1];
      out += next && /^[pbm]/.test(next.c || "") ? "m" : "n";
    }
    if (s.h) out += "h";
  });
  return out;
}

const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

export function toLatin(text) {
  const s = String(text || "");
  if (!hasGujarati(s)) return s;
  return s.replace(/[઀-૿]+/g, (w) => cap(guWordToLatin(w)));
}

// ---------------------------------------------------------------- English → Gujarati
const L_CONS = [
  ["chh", "છ"], ["ksh", "ક્ષ"], ["shr", "શ્ર"], ["kh", "ખ"], ["gh", "ઘ"], ["ch", "ચ"], ["jh", "ઝ"],
  ["th", "થ"], ["dh", "ધ"], ["ph", "ફ"], ["bh", "ભ"], ["sh", "શ"], ["gn", "જ્ઞ"],
  ["k", "ક"], ["g", "ગ"], ["c", "ક"], ["j", "જ"], ["z", "ઝ"], ["t", "ત"], ["d", "દ"], ["n", "ન"],
  ["p", "પ"], ["f", "ફ"], ["b", "બ"], ["m", "મ"], ["y", "ય"], ["r", "ર"], ["l", "લ"], ["v", "વ"],
  ["w", "વ"], ["s", "સ"], ["h", "હ"], ["q", "ક"], ["x", "ક્સ"],
];
const L_VOW = [
  ["aa", "આ", "ા"], ["ai", "ઐ", "ૈ"], ["au", "ઔ", "ૌ"], ["ee", "ઈ", "ી"], ["ii", "ઈ", "ી"], ["oo", "ઊ", "ૂ"],
  ["uu", "ઊ", "ૂ"], ["ou", "ઓ", "ો"], ["a", "અ", ""], ["e", "એ", "ે"], ["i", "ઇ", "િ"], ["o", "ઓ", "ો"], ["u", "ઉ", "ુ"],
];
function take(table, w, i) {
  for (const row of table) if (w.startsWith(row[0], i)) return row;
  return null;
}
function latinWordToGu(word) {
  const lw = word.toLowerCase();
  if (EN2GU.has(lw)) return EN2GU.get(lw);
  for (const suf of SUFFIXES)
    if (lw.length > suf.length + 1 && lw.endsWith(suf)) return latinWordToGu(lw.slice(0, -suf.length)) + EN2GU.get(suf);
  let out = "";
  let i = 0;
  let pendingCons = null; // consonant waiting for its vowel
  const flush = (virama) => {
    if (pendingCons) out += pendingCons + (virama ? VIRAMA : "");
    pendingCons = null;
  };
  while (i < lw.length) {
    const v = take(L_VOW, lw, i);
    if (v) {
      // A final short "a" is usually long in names ("Vala", "Rana", "Asha").
      const finalA = v[0] === "a" && i === lw.length - 1 && i > 0;
      if (pendingCons) {
        out += pendingCons + (finalA ? "ા" : v[2]);
        pendingCons = null;
      } else {
        out += finalA ? "આ" : v[1];
      }
      // "i" at the end of a word is long (Solanki → સોલંકી).
      if (v[0] === "i" && i + 1 === lw.length) out = out.replace(/િ$/, "ી");
      i += v[0].length;
      continue;
    }
    const c = take(L_CONS, lw, i);
    if (!c) {
      flush(false);
      out += word[i];
      i++;
      continue;
    }
    const nextIsVowel = !!take(L_VOW, lw, i + c[0].length);
    const atEnd = i + c[0].length >= lw.length;
    // n / m before another consonant become the nasal dot (Jaswant → જસવંત).
    if ((c[0] === "n" || c[0] === "m") && !nextIsVowel && !atEnd && out && !pendingCons) {
      out += "ં";
      i += 1;
      continue;
    }
    if (pendingCons) {
      // Clusters written joined: doubled letters, r and y after a consonant,
      // and clusters at the start of a word; otherwise the inherent "a" stays.
      const join = pendingCons === c[1] || c[0] === "r" || c[0] === "y" || out === "";
      flush(join);
    }
    pendingCons = c[1];
    i += c[0].length;
    if (atEnd) flush(false);
  }
  flush(false);
  return out;
}

export function toGujarati(text) {
  const s = String(text || "");
  if (!hasLatin(s)) return s;
  return s.replace(/[A-Za-z]+/g, (w) => latinWordToGu(w));
}

// Both scripts for one piece of text typed in either.
export function bothScripts(text) {
  const s = String(text || "").trim();
  if (!s) return { en: "", gu: "" };
  if (hasGujarati(s) && !hasLatin(s)) return { en: toLatin(s), gu: s };
  if (hasLatin(s) && !hasGujarati(s)) return { en: s, gu: toGujarati(s) };
  return { en: toLatin(s), gu: toGujarati(s) };
}

// What to show for a member field in the chosen language.
export function nameFor(m, lang) {
  if (!m) return "";
  if (lang === "en") {
    const en = m.name || "";
    return hasGujarati(en) ? toLatin(en) : en || toLatin(m.nameGu || "");
  }
  const gu = m.nameGu || "";
  return gu && hasGujarati(gu) ? gu : toGujarati(m.name || gu);
}
export function placeFor(m, lang) {
  if (!m) return "";
  if (lang === "en") return m.currentLocationEn || toLatin(m.currentLocation || "");
  return m.currentLocationGu || toGujarati(m.currentLocation || "");
}
