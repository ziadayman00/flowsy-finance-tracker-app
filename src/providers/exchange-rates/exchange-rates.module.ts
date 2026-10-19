import { Module } from '@nestjs/common';
import { NoopExchangeRateAdapter } from './noop-exchange-rate.adapter';

export const EXCHANGE_RATE_PROVIDER = 'EXCHANGE_RATE_PROVIDER';

/**
 * ExchangeRatesModule wires the active ExchangeRateProvider adapter.
 *
 * Currently registers NoopExchangeRateAdapter so the app boots without a
 * live provider. To swap in a real provider:
 *
 *   1. Create your adapter: `class OpenExchangeRatesAdapter implements ExchangeRateProvider`
 *   2. Replace `useClass: NoopExchangeRateAdapter` with `useClass: OpenExchangeRatesAdapter`
 *   3. Inject `ConfigService` in the adapter constructor to read the API key from env.
 *
 * Domain modules that need exchange rates inject by token:
 *   @Inject(EXCHANGE_RATE_PROVIDER) private readonly rateProvider: ExchangeRateProvider
 */
@Module({
  providers: [
    {
      provide: EXCHANGE_RATE_PROVIDER,
      useClass: NoopExchangeRateAdapter,
    },
  ],
  exports: [EXCHANGE_RATE_PROVIDER],
})
export class ExchangeRatesModule {}
