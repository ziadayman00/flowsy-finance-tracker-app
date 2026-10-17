import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy and database is connected.',
  })
  @ApiResponse({
    status: 503,
    description: 'Service or database is unhealthy.',
  })
  async check(@Res() res: Response): Promise<Response> {
    let dbStatus = 'disconnected';
    let isHealthy = false;

    try {
      // Execute lightweight query to confirm database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      isHealthy = true;
    } catch (err: unknown) {
      dbStatus = 'unreachable';
      isHealthy = false;
    }

    const payload = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        status: dbStatus,
      },
    };

    return res
      .status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(payload);
  }
}
