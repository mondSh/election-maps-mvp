// Letter-symbol → party mapping, per Knesset election.
//
// WHY THIS IS HAND-CURATED (and must be): each ballot file labels parties only
// by their list-letter (אות), and *the same letter denotes different parties in
// different elections*. The official `candidates-lists` dataset has NO Knesset-25
// rows, so the K25 majors below are curated from the CEC site (votes25.bechirot.gov.il)
// and verified against the live vote columns (e.g. עם dominates Bedouin localities →
// עם = רע"ם, while ום = חד"ש-תע"ל — the opposite of an early draft).
//
// `family` is the CANONICAL party id used to connect parties across elections for
// the vote-migration (Sankey) estimate. Letters not listed here fold into "אחר".

// Canonical families (cross-election identity) and their brand-ish colors.
export const FAMILIES = {
  likud:      { label: "הליכוד",            color: "#1f4e8c" },
  yesh_atid:  { label: "יש עתיד",           color: "#15b3d6" },
  shas:       { label: 'ש"ס',               color: "#0e8a7d" },
  utj:        { label: "יהדות התורה",        color: "#6b6f76" },
  rz:         { label: "הציונות הדתית",      color: "#3b2e7e" },
  labor:      { label: "העבודה",            color: "#e4002b" },
  gantz:      { label: "המחנה הממלכתי",      color: "#4b6584" },
  yb:         { label: "ישראל ביתנו",        color: "#86c5e8" },
  meretz:     { label: "מרצ",               color: "#43a047" },
  raam:       { label: 'רע"ם',              color: "#1d9b6c" },
  hadash:     { label: 'חד"ש־תע"ל',         color: "#b3322c" },
  balad:      { label: 'בל"ד',              color: "#7b4fb0" },
  joint:      { label: "הרשימה המשותפת",     color: "#9b2d24" },
  yamina:     { label: "ימינה",             color: "#1aa0a0" },
  newhope:    { label: "תקווה חדשה",         color: "#5a8fbf" },
  habait:     { label: "הבית היהודי",        color: "#2e6b4f" },
  other:      { label: "אחר",               color: "#c9ccd1" },
};

// Official Knesset-25 seat allocation (CEC final results, after the 3.25% threshold
// and the Bader-Ofer apportionment). Sums to 120. `bloc` groups parties for the
// coalition-builder presets: net = pro-Netanyahu, opp = opposition/centre-left, arab.
// (Meretz and Balad fell below the threshold → 0 seats.)
export const SEATS_25 = {
  likud:     { seats: 32, bloc: "net" },
  yesh_atid: { seats: 24, bloc: "opp" },
  rz:        { seats: 14, bloc: "net" },
  gantz:     { seats: 12, bloc: "opp" },
  shas:      { seats: 11, bloc: "net" },
  utj:       { seats: 7,  bloc: "net" },
  yb:        { seats: 6,  bloc: "opp" },
  raam:      { seats: 5,  bloc: "arab" },
  hadash:    { seats: 5,  bloc: "arab" },
  labor:     { seats: 4,  bloc: "opp" },
};

// Knesset 25 (2022) — letter → family.
export const K25_LETTERS = {
  "מחל": "likud",
  "פה":  "yesh_atid",
  "שס":  "shas",
  "ג":   "utj",
  "ט":   "rz",
  "אמת": "labor",
  "כן":  "gantz",      // המחנה הממלכתי (גנץ–סער–אייזנקוט)
  "ל":   "yb",
  "מרצ": "meretz",
  "עם":  "raam",       // רע"ם (verified: dominant in Bedouin localities)
  "ום":  "hadash",     // חד"ש־תע"ל
  "ד":   "balad",      // בל"ד
  "ב":   "habait",     // הבית היהודי (אורבך) — לא עברה את אחוז החסימה
};

// Knesset 24 (2021) — letter → family. Note the different scheme vs K25.
export const K24_LETTERS = {
  "מחל": "likud",
  "פה":  "yesh_atid",
  "שס":  "shas",
  "ג":   "utj",
  "ט":   "rz",
  "אמת": "labor",
  "כן":  "gantz",      // כחול לבן (גנץ)
  "ת":   "newhope",    // תקווה חדשה (סער) — מוזגה ל"מחנה הממלכתי" ב-25
  "ל":   "yb",
  "מרצ": "meretz",
  "עם":  "raam",
  "ודעם":"joint",      // הרשימה המשותפת — התפצלה ל-25 (חד"ש־תע"ל + בל"ד)
  "ב":   "yamina",     // ימינה (בנט) — התפזרה ב-25
};

export const LETTERS_BY_KNESSET = { 24: K24_LETTERS, 25: K25_LETTERS };

// Non-party administrative columns present in every vote file.
export const META_COLS = new Set([
  "_id", "סמל ועדה", "סמל ישוב", "שם ישוב", "בזב", "מצביעים", "פסולים", "כשרים", "קלפי", "סמל קלפי",
]);
