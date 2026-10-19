/**
 * Provider-independent exchange rate interface.
 *
 * Design rules:
 * - This interface is the ONLY contract the application depends on.
 *   Provider-specific code lives in adapter classes (e.g. OpenExchangeRatesAdapter)
 *   and is never imported directly by domain services.
 * - The application must remain functional when this provider is unavailable
 *   (use cached rates, throw a clear error, or fall back to a manual rate entry).
 * - Never store provider API keys in source code — use environment variables.
 * - Never assume a provider supports a specific country/currency without
 *   verifying their documentation. Egypt (EGP) and Gulf currencies may require
 *   a paid tier on some providers.
 */
export interface ExchangeRateResult {
  /** Base currency (e.g. 'EGP') */
  baseCurrency: string;
  /** Target currency (e.g. 'USD') */
  targetCurrency: string;
  /** Exchange rate: 1 unit of baseCurrency = rate units of targetCurrency */
  rate: string; // Decimal string — never a JS float
  /** UTC timestamp when the rate was published by the provider */
  rateTimestamp: Date;
  /** Name of the provider that supplied this rate (for audit trail) */
  providerName: string;
}

export interface ExchangeRateProvider {
  /**
   * Returns the exchange rate from baseCurrency to targetCurrency.
   *
   * Implementations MUST:
   * - Return a Decimal string (not a JS number) to prevent float precision loss.
   * - Include the rateTimestamp from the provider, not the current server time.
   * - Throw a typed error (ProviderUnavailableError, RateLimitError, etc.)
   *   rather than returning null/undefined for failure cases.
   * - Handle provider-side retries with exponential back-off before throwing.
   * - Never fabricate a rate or return a hardcoded fallback silently.
   *
   * @throws ProviderUnavailableError if the provider cannot be reached.
   * @throws UnsupportedCurrencyPairError if the pair is not supported.
   */
  getRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRateResult>;

  /**
   * Returns all available rates for a given base currency in one call.
   * More efficient than repeated getRate() calls for multi-currency dashboards.
   */
  getAllRates(baseCurrency: string): Promise<ExchangeRateResult[]>;

  /**
   * The canonical name of this provider.
   * Used in audit trails and log messages.
   */
  readonly providerName: string;

  /**
   * The set of currency codes this provider is known to support.
   * Used to validate requests before making API calls.
   * Must be verified against the provider's official documentation.
   */
  readonly supportedCurrencies: ReadonlySet<string>;
}
