import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';
import { parseCorsOrigins } from './cors.config';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @MinLength(16)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  DEFAULT_CURRENCY: string = 'EGP';

  @IsString()
  @IsOptional()
  DEFAULT_TIMEZONE: string = 'Africa/Cairo';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formattedErrors = errors
      .map(
        (err) =>
          `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Environment validation failed: ${formattedErrors}`);
  }

  // Strict CORS allowlist validation for environment
  try {
    parseCorsOrigins(
      config.CORS_ORIGIN as string | undefined,
      validatedConfig.NODE_ENV,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Environment validation failed: CORS_ORIGIN: ${message}`);
  }

  return validatedConfig;
}
