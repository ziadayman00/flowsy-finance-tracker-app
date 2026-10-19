/**
 * Deterministic Category Matcher for Flowsy Expense Categories.
 *
 * Matches categories based on:
 * 1. Category name exact and standardized match.
 * 2. Predefined Egyptian Arabic colloquial aliases (e.g. "غدا", "عشا", "فطار" -> Food/طعام; "أوبر", "تاكسي", "ميكروباص", "بنزين" -> Transport/مواصلات).
 * 3. User custom aliases saved in local configuration.
 *
 * Does not hardcode database IDs; accepts the user's active categories array dynamically.
 */

import { removeDiacritics, standardizeArabicLetters } from './normalizer';
import { CategoryAliasItem } from './types';

export interface CategoryMatchResult {
  categoryId: string;
  categoryName: string;
  matchedAlias: string;
  isAmbiguous: boolean;
  confidenceScore: number; // 1.0 exact, 0.8 alias, 0.5 fuzzy
}

// Explicit category name tokens mapped to each theme
const THEME_CATEGORY_NAMES: Record<string, string[]> = {
  food: ['طعام', 'اكل', 'أكل', 'مطاعم', 'مأكولات', 'مشروبات'],
  transport: ['مواصلات', 'انتقالات', 'سيارة', 'وقود', 'مركبات'],
  bills: ['فواتير', 'مرافق', 'خدمات', 'كهرباء', 'اتصالات', 'شحن'],
  health: ['صحة', 'علاج', 'طبية', 'ادوية', 'أدوية', 'صيدلية'],
  shopping: ['تسوق', 'ملابس', 'مشتريات'],
  entertainment: ['ترفيه', 'فسح', 'خروجات'],
};

// Built-in Egyptian semantic keywords mapped to common category themes
const DEFAULT_THEMATIC_ALIASES: Record<string, string[]> = {
  // Food & Dining
  food: [
    'طعام', 'اكل', 'أكل', 'مطعم', 'غدا', 'غداء', 'عشا', 'عشاء', 'فطار', 'إفطار',
    'سوبرماركت', 'ماركت', 'بقال', 'بقالة', 'خضار', 'فاكهة', 'كافيه', 'قهوة', 'شاي',
    'ماك', 'كنتاكي', 'بيتزا', 'شاورما', 'حلويات', 'عصير', 'كشرى', 'كشري',
  ],
  // Transportation & Vehicle
  transport: [
    'مواصلات', 'عربيه', 'عربية', 'سيارة', 'بنزين', 'سولار', 'اوبر', 'أوبر', 'كريم',
    'تاكسي', 'مترو', 'ميكروباص', 'أتوبيس', 'اتوبيس', 'قطر', 'قطار', 'كارته', 'كارتة',
    'ركنة', 'باركينج', 'غسيل العربية', 'صيانة',
  ],
  // Housing & Bills
  bills: [
    'فواتير', 'فاتورة', 'كهرباء', 'كهربه', 'مياه', 'ميه', 'غاز', 'نت', 'انترنت',
    'إنترنت', 'واي فاي', 'شحن', 'رصيد', 'فودافون', 'أورنج', 'اورنج', 'اتصالات', 'وي',
    'ايجار', 'إيجار', 'صيانة العمارة',
  ],
  // Health & Medicine
  health: [
    'صحة', 'علاج', 'دكتور', 'طبيب', 'صيدلية', 'دوا', 'دواء', 'كشف', 'تحاليل', 'اشعة', 'أشعة',
  ],
  // Shopping & Personal Care
  shopping: [
    'تسوق', 'شوبينج', 'هدوم', 'ملابس', 'جزمة', 'شوز', 'عناية', 'حلاقة', 'صالون', 'جيم',
  ],
  // Entertainment & Leisure
  entertainment: [
    'ترفيه', 'سينما', 'خروجة', 'سفر', 'رحلة', 'العاب', 'ألعاب', 'اشتراك', 'نتفليكس',
  ],
};

function normalizeForComparison(str: string): string {
  return standardizeArabicLetters(removeDiacritics(str.toLowerCase().trim()));
}

/**
 * Matches an expense phrase against available categories.
 */
export function matchCategory(
  phrase: string,
  categories: CategoryAliasItem[],
  customAliases: Record<string, string[]> = {},
): CategoryMatchResult | null {
  if (!categories || categories.length === 0 || !phrase) return null;

  const normalizedPhrase = normalizeForComparison(phrase);
  const words = normalizedPhrase.split(/\s+/).filter(Boolean);

  // 1. Direct Category Name Match (Exact or Contains)
  for (const cat of categories) {
    const catNorm = normalizeForComparison(cat.name);
    // Check if category name appears in phrase
    if (normalizedPhrase.includes(catNorm)) {
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        matchedAlias: cat.name,
        isAmbiguous: false,
        confidenceScore: 1.0,
      };
    }
  }

  // 2. Custom User-defined Aliases Match
  for (const cat of categories) {
    const aliases = customAliases[cat.id] || [];
    for (const alias of aliases) {
      const aliasNorm = normalizeForComparison(alias);
      for (const word of words) {
        if (word === aliasNorm || normalizedPhrase.includes(aliasNorm)) {
          return {
            categoryId: cat.id,
            categoryName: cat.name,
            matchedAlias: alias,
            isAmbiguous: false,
            confidenceScore: 0.95,
          };
        }
      }
    }
  }

  // 3. Built-in Thematic Egyptian Colloquial Aliases Match
  for (const [theme, keywords] of Object.entries(DEFAULT_THEMATIC_ALIASES)) {
    for (const kw of keywords) {
      const kwNorm = normalizeForComparison(kw);
      const isWordMatch = words.some((w) => w === kwNorm);

      if (isWordMatch) {
        // Find category matching this theme using explicit category tokens
        const themeTokens = THEME_CATEGORY_NAMES[theme] || [];
        const matchedCategory = categories.find((cat) => {
          const catNorm = normalizeForComparison(cat.name);
          return themeTokens.some((tok) => catNorm.includes(normalizeForComparison(tok)));
        });

        if (matchedCategory) {
          return {
            categoryId: matchedCategory.id,
            categoryName: matchedCategory.name,
            matchedAlias: kw,
            isAmbiguous: false,
            confidenceScore: 0.85,
          };
        }
      }
    }
  }

  return null;
}
