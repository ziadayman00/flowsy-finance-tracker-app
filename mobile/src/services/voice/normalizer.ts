/**
 * Egyptian Arabic text normalizer for voice financial entries.
 * Normalizes Eastern Arabic-Indic numerals, common Egyptian colloquial spelling
 * variations, punctuation, and whitespace while preserving numeric meaning and original wording.
 */

const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

// Map of common colloquial Egyptian phonetic/written spelling variations
const PHONETIC_VARIANTS: [RegExp, string][] = [
  // Hundreds variations
  [/\b(تلاتميه|تلتميه|تلاتمية|تلتمية|ثلاثمائة|تلاتة\s*مية|تلات\s*مية)\b/g, '300'],
  [/\b(اربعميه|أربعميه|اربعمية|أربعمية|أربعمائة|اربعمائة|اربعة\s*مية|أربعة\s*مية)\b/g, '400'],
  [/\b(خمسميه|خمسمية|خمسمائة|خمسة\s*مية)\b/g, '500'],
  [/\b(ستميه|ستمية|ستمائة|ستة\s*مية)\b/g, '600'],
  [/\b(سبعميه|سبعمية|سبعمائة|سبعة\s*مية)\b/g, '700'],
  [/\b(تمنميه|تمنمية|ثمنمائة|تمانميه|تمانمية|ثمانمائة|تمانية\s*مية)\b/g, '800'],
  [/\b(تسعميه|تسعمية|تسعمائة|تسعة\s*مية)\b/g, '900'],
  [/\b(ميتين|مائتين|مئتين|مائتان|مئتان)\b/g, '200'],
  [/\b(ميه|مية|مائة|مئة)\b/g, '100'],

  // Thousands
  [/\b(الفين|ألفين|ألفان|الفان)\b/g, '2000'],
  [/\b(الف|ألف)\b/g, '1000'],
  [/\b(تلات\s*تلاف|تلات\s*آلاف|تلات\s*الاف|ثلاثة\s*آلاف|ثلاثة\s*الاف)\b/g, '3000'],
  [/\b(اربع\s*تلاف|أربع\s*تلاف|اربع\s*آلاف|أربع\s*آلاف|أربعة\s*آلاف)\b/g, '4000'],
  [/\b(خمس\s*تلاف|خمس\s*آلاف|خمسة\s*آلاف)\b/g, '5000'],
  [/\b(ست\s*تلاف|ست\s*آلاف|ستة\s*آلاف)\b/g, '6000'],
  [/\b(سبع\s*تلاف|سبع\s*آلاف|سبعة\s*آلاف)\b/g, '7000'],
  [/\b(تمن\s*تلاف|ثمان\s*آلاف|ثمانية\s*آلاف|تمان\s*تلاف)\b/g, '8000'],
  [/\b(تسع\s*تلاف|تسعة\s*آلاف)\b/g, '9000'],
  [/\b(عشر\s*تلاف|عشرة\s*آلاف)\b/g, '10000'],

  // Tens
  [/\b(عشرين)\b/g, '20'],
  [/\b(تلاتين|ثلاثين)\b/g, '30'],
  [/\b(اربعين|أربعين)\b/g, '40'],
  [/\b(خمسين)\b/g, '50'],
  [/\b(ستين)\b/g, '60'],
  [/\b(سبعين)\b/g, '70'],
  [/\b(تمانين|ثمانين)\b/g, '80'],
  [/\b(تسعين)\b/g, '90'],

  // Teens (11-19)
  [/\b(حداشر|أحد\s*عشر|إحدى\s*عشر)\b/g, '11'],
  [/\b(اثناشر|اتناشر|إثنا\s*عشر|اثني\s*عشر)\b/g, '12'],
  [/\b(تلاتاشر|تلتاشر|ثلاثة\s*عشر)\b/g, '13'],
  [/\b(اربعتاشر|أربعتاشر|أربعة\s*عشر|اربعة\s*عشر)\b/g, '14'],
  [/\b(خمستاشر|خمسة\s*عشر)\b/g, '15'],
  [/\b(ستاشر|ستة\s*عشر)\b/g, '16'],
  [/\b(سبعتاشر|سبعة\s*عشر)\b/g, '17'],
  [/\b(تمنتاشر|تمانتاشر|ثمانية\s*عشر)\b/g, '18'],
  [/\b(تسعتاشر|تسعة\s*عشر)\b/g, '19'],

  // Units
  [/\b(عشرة|عشر)\b/g, '10'],
  [/\b(تسعة|تسع)\b/g, '9'],
  [/\b(تمانية|ثمانية|تمان|ثمان)\b/g, '8'],
  [/\b(سبعة|سبع)\b/g, '7'],
  [/\b(ستة|ست)\b/g, '6'],
  [/\b(خمسة|خمس)\b/g, '5'],
  [/\b(أربعة|اربعة|اربع|أربع)\b/g, '4'],
  [/\b(تلاتة|ثلاثة|تلات|ثلاث)\b/g, '3'],
  [/\b(اتنين|إتنين|اثنان|إثنان|اثنين|إثنين)\b/g, '2'],
  [/\b(واحد|واحدة)\b/g, '1'],
  [/\b(صفر)\b/g, '0'],

  // Colloquial temporal spellings
  [/\b(النهاردة|النهارده|انهارده|النهارة)\b/g, 'النهارده'],
  [/\b(امبارح|إمبارح|البارحة|أمس)\b/g, 'امبارح'],
  [/\b(اول\s*امبارح|أول\s*إمبارح|اول\s*امس|أول\s*أمس)\b/g, 'أول امبارح'],
  [/\b(بكرة|بكره|غدا|غداً)\b/g, 'بكره'],
];

/**
 * Converts Eastern Arabic numerals (٠-٩) to Western Arabic digits (0-9).
 */
export function convertArabicIndicDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (digit) => EASTERN_ARABIC_DIGITS[digit] || digit);
}

/**
 * Strips Arabic diacritics (tashkeel/harakat) and tatweel/kashida.
 */
export function removeDiacritics(text: string): string {
  // Tashkeel unicode range: \u064B - \u065F, Tatweel: \u0640
  return text.replace(/[\u064B-\u065F\u0640]/g, '');
}

/**
 * Standardizes Arabic letter variants (Alef, Taa Marbuta / Haa, Yaa / Alef Maksura)
 * for matching, without mangling distinct grammatical meanings.
 */
export function standardizeArabicLetters(text: string): string {
  return text
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Normalizes full Arabic transcript into a clean representation
 * suitable for tokenization and financial semantic parsing.
 */
export function normalizeArabicTranscript(raw: string): string {
  if (!raw) return '';

  let text = raw.trim();

  // 1. Remove diacritics and tatweel
  text = removeDiacritics(text);

  // 2. Convert Eastern Arabic numerals
  text = convertArabicIndicDigits(text);

  // 3. Normalize punctuation: Arabic comma (،) and semicolon (؛) to standard separators
  text = text.replace(/[\u060C,]/g, ' ، ');
  text = text.replace(/[\u061B;]/g, ' ؛ ');
  text = text.replace(/[.!?]/g, ' . ');

  // 4. Ensure space around conjunction 'و' when attached to number words or digits
  text = text.replace(/(^|\s)و([0-9]+)/g, (_m, p1, p2) => `${p1}و ${p2}`);
  text = text.replace(
    /(^|\s)و(عشرين|تلاتين|اربعين|خمسين|ستين|سبعين|تمانين|تسعين|مية|ميه|ميتين|الف|الفين|خمسمية|خمسميه|تلتمية|تلتميه|تلاتمية|تلاتميه|ربع|نص)(\s|$|[،؛.])/g,
    (_m, p1, p2, p3) => `${p1}و ${p2}${p3}`,
  );

  // 5. Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
