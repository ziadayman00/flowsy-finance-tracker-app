/**
 * IsSupportedTimezone — class-validator decorator
 *
 * Validates that a timezone string is a valid IANA timezone identifier
 * recognized by the runtime's Intl implementation.
 *
 * Uses `Intl.DateTimeFormat` resolution: if the string is not a valid IANA
 * zone, Intl throws a RangeError.
 */
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isSupportedTimezone', async: false })
export class IsSupportedTimezoneConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone identifier (e.g. "Africa/Cairo", "Asia/Riyadh")';
  }
}

export function IsSupportedTimezone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSupportedTimezoneConstraint,
    });
  };
}
