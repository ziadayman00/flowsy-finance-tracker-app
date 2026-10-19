/**
 * Arabic Pluralization Rules per Section 13.5
 * 1 -> singular (معاملة واحدة / معاملة)
 * 2 -> dual (معاملتين / التزامين)
 * 3..10 -> plural (3 معاملات / 3 التزامات)
 * >=11 -> singular (15 معاملة / 15 التزام)
 */

export interface PluralForms {
  singular: string;
  dual: string;
  plural: string;
}

export function formatPlural(count: number, forms: PluralForms): string {
  const abs = Math.abs(count);
  if (abs === 0) {
    return `0 ${forms.singular}`;
  }
  if (abs === 1) {
    return forms.singular;
  }
  if (abs === 2) {
    return forms.dual;
  }
  if (abs >= 3 && abs <= 10) {
    return `${abs} ${forms.plural}`;
  }
  return `${abs} ${forms.singular}`;
}

export function formatCommitmentsCount(count: number): string {
  return formatPlural(count, {
    singular: 'التزام',
    dual: 'التزامين',
    plural: 'التزامات',
  });
}

export function formatTransactionsCount(count: number): string {
  return formatPlural(count, {
    singular: 'معاملة',
    dual: 'معاملتين',
    plural: 'معاملات',
  });
}

export function formatDaysCount(count: number): string {
  return formatPlural(count, {
    singular: 'يوم',
    dual: 'يومين',
    plural: 'أيام',
  });
}
