/**
 * Typed errors for exchange rate provider failures.
 *
 * Using dedicated error classes (rather than generic Error or string codes)
 * allows callers to handle specific failure modes with catch clauses,
 * and allows the global exception filter to map them to appropriate HTTP statuses.
 */

/** Thrown when the upstream provider is unreachable, timed out, or returned a 5xx. */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly cause?: Error,
  ) {
    super(`Exchange rate provider "${providerName}" is currently unavailable.`);
    this.name = 'ProviderUnavailableError';
  }
}

/** Thrown when a requested currency pair is not supported by the provider. */
export class UnsupportedCurrencyPairError extends Error {
  constructor(
    public readonly baseCurrency: string,
    public readonly targetCurrency: string,
    public readonly providerName: string,
  ) {
    super(
      `Currency pair ${baseCurrency}/${targetCurrency} is not supported by provider "${providerName}". ` +
        'Verify the provider documentation for Egypt (EGP) and Gulf currency support.',
    );
    this.name = 'UnsupportedCurrencyPairError';
  }
}

/** Thrown when the provider returns a rate-limit response (HTTP 429). */
export class RateLimitError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly retryAfterSeconds?: number,
  ) {
    const retryMsg = retryAfterSeconds
      ? ` Retry after ${retryAfterSeconds} seconds.`
      : '';
    super(
      `Exchange rate provider "${providerName}" rate limit exceeded.${retryMsg}`,
    );
    this.name = 'RateLimitError';
  }
}

/** Thrown when the provider response cannot be parsed or contains unexpected data. */
export class MalformedProviderResponseError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly detail: string,
  ) {
    super(
      `Exchange rate provider "${providerName}" returned malformed data: ${detail}`,
    );
    this.name = 'MalformedProviderResponseError';
  }
}
