// Settlement-name hygiene. The CEC by-settlement files spell a handful of names
// with no internal spaces ("מודיעיןמכביםרעות") or doubled spaces ("תל אביב  יפו").
// We (a) collapse runs of whitespace, and (b) restore the proper separators for the
// concatenated compound/hyphenated names.
//
// The corrections are the authoritative CBS spellings (HEB_NAME on the socio-economic
// FeatureServer, keyed by SETL_CODE), retrieved 2026-06-14 — not hand-invented. Only
// names whose letters match the CEC form (ignoring separators) were overridden; genuine
// single-word names (פוריידיס, מוקייבלה, בארותיים, חשמונאים) are left untouched.
// Keys are the post-whitespace-collapse CEC names; identity fixes are omitted (the
// collapse alone already handles e.g. "פוריה  כפר עבודה" → "פוריה כפר עבודה").
export const NAME_FIXES = {
  "קדימהצורן": "קדימה-צורן",
  "חצוראשדוד": "חצור-אשדוד",
  "בועיינהנוגידאת": "בועיינה-נוג'ידאת",
  "שבלי אום אלגנם": "שבלי - אום אל-גנם",
  "טובאזנגריה": "טובא-זנגרייה",
  "כעביהטבאשחגאגרה": "כעביה-טבאש-חג'אג'רה",
  "מעלותתרשיחא": "מעלות-תרשיחא",
  "ערערהבנגב": "ערערה-בנגב",
  "מודיעיןמכביםרעות": "מודיעין-מכבים-רעות",
  "גדיידהמכר": "ג'דיידה-מכר",
  "כסראסמיע": "כסרא-סמיע",
  "תל אביב יפו": "תל אביב-יפו",
  "יהודמונוסון": "יהוד-מונוסון",
};

/** Trim, collapse internal whitespace, then apply the authoritative separator fix. */
export function cleanName(raw) {
  const collapsed = String(raw ?? "").trim().replace(/\s+/g, " ");
  return NAME_FIXES[collapsed] ?? collapsed;
}
