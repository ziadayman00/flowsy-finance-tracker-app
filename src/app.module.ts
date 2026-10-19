import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FinancialAccountsModule } from './financial-accounts/financial-accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CommitmentsModule } from './commitments/commitments.module';
import { BudgetsModule } from './budgets/budgets.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { ImportModule } from './import/import.module';
import { ExchangeRatesModule } from './providers/exchange-rates/exchange-rates.module';
import { NotificationsModule } from './providers/notifications/notifications.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        // Named 'auth' throttler used by auth endpoints for brute-force protection.
        // Auth controller applies: @Throttle({ auth: { limit: 5, ttl: 60000 } })
        // on sensitive mutation endpoints (login, register, refresh).
        name: 'auth',
        ttl: 60000,
        limit: 5,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    FinancialAccountsModule,
    CategoriesModule,
    TransactionsModule,
    CommitmentsModule,
    BudgetsModule,
    DashboardModule,
    SavingsGoalsModule,
    ForecastingModule,
    ImportModule,
    ExchangeRatesModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
