/**
 * IsSupportedCurrency — class-validator decorator
 *
 * Validates that the submitted string is one of the currencies supported by
 * Flowsy's initial market scope (Egypt + Gulf). This allowlist is deliberately
 * narrow: accepting any ISO 4217 code would allow users to set unsupported
 * currencies that break downstream multi-currency reporting.
 *
 * Adding a new currency requires a conscious product decision, not merely
 * passing an ISO standard string.
 */
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Supported currency codes.
 *
 * Rationale for each group:
 * - EGP: primary market (Egypt).
 * - SAR, AED, KWD, QAR, BHD, OMR: Gulf Cooperation Council currencies
 *   explicitly listed in the product scope.
 * - USD, EUR: common hard-currency savings accounts held by Egyptian / Gulf users.
 */
export const SUPPORTED_CURRENCIES = [
  'EGP', // Egyptian Pound
  'SAR', // Saudi Riyal
  'AED', // UAE Dirham
  'KWD', // Kuwaiti Dinar
  'QAR', // Qatari Riyal
  'BHD', // Bahraini Dinar
  'OMR', // Omani Rial
  'USD', // US Dollar (hard currency savings)
  'EUR', // Euro (hard currency savings)
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

@ValidatorConstraint({ name: 'isSupportedCurrency', async: false })
export class IsSupportedCurrencyConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
    );
  }

  defaultMessage(): string {
    return `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`;
  }
}

export function IsSupportedCurrency(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSupportedCurrencyConstraint,
    });
  };
}
