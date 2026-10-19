import { Injectable, Logger } from '@nestjs/common';
import {
  ExchangeRateProvider,
  ExchangeRateResult,
} from './exchange-rate.provider.interface';
import {
  ProviderUnavailableError,
  UnsupportedCurrencyPairError,
} from './exchange-rate.errors';

/**
 * Stub adapter — returns a clear error indicating no live provider is connected.
 *
 * This adapter is registered as the active ExchangeRateProvider when no real
 * provider API key is configured. It allows the application to boot and run
 * without a live exchange rate feed, while making the absence explicit in logs
 * and API responses.
 *
 * When a real provider is integrated:
 * 1. Create a new adapter class implementing ExchangeRateProvider.
 * 2. Register it in ExchangeRatesModule, replacing this stub.
 * 3. Write unit tests for the adapter with mocked HTTP responses.
 * 4. Add the required env variable (e.g. EXCHANGE_RATE_API_KEY) to
 *    EnvironmentVariables in src/config/env.validation.ts.
 *
 * Candidate providers verified for EGP and Gulf currencies:
 * - https://openexchangerates.org (paid plan for EGP/Gulf)
 * - https://www.exchangerate-api.com (verify EGP support on chosen plan)
 * - https://fixer.io (EUR-based, verify EGP/Gulf support)
 *
 * IMPORTANT: Never assume a provider supports a specific country until verified.
 * The Middle East and Egypt are not always included on free tiers.
 */
@Injectable()
export class NoopExchangeRateAdapter implements ExchangeRateProvider {
  readonly providerName = 'noop-stub';
  readonly supportedCurrencies: ReadonlySet<string> = new Set();

  private readonly logger = new Logger(NoopExchangeRateAdapter.name);

  getRate(baseCurrency: string, targetCurrency: string): Promise<ExchangeRateResult> {
    this.logger.warn(
      `Exchange rate requested (${baseCurrency}→${targetCurrency}) but no provider is configured. ` +
        'Register a real ExchangeRateProvider adapter to enable live rates.',
    );
    throw new ProviderUnavailableError(
      this.providerName,
      new Error('No exchange rate provider has been configured.'),
    );
  }

  getAllRates(_baseCurrency: string): Promise<ExchangeRateResult[]> {
    throw new ProviderUnavailableError(
      this.providerName,
      new Error('No exchange rate provider has been configured.'),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected assertSupported(base: string, target: string): void {
    throw new UnsupportedCurrencyPairError(base, target, this.providerName);
  }
}
