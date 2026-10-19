/**
 * Bilingual Name Handling per Section 13.4
 * Seeded names often combine languages: "كاش / Cash", "Groceries / بقالة ومستلزمات".
 * Extracts the Arabic segment for UI rendering while preserving the original name on write.
 */

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function displayName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  if (name.includes(' / ')) {
    const parts = name.split(' / ').map((p) => p.trim());
    const arabicPart = parts.find((p) => ARABIC_REGEX.test(p));
    if (arabicPart) {
      return arabicPart;
    }
    return parts[0] || name;
  }

  return name.trim();
}
