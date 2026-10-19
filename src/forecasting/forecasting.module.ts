import { Module } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { ForecastingController } from './forecasting.controller';
import { PrismaModule } from '../database/prisma.module';
import { CommitmentsModule } from '../commitments/commitments.module';

@Module({
  imports: [PrismaModule, CommitmentsModule],
  controllers: [ForecastingController],
  providers: [ForecastingService],
})
export class ForecastingModule {}
