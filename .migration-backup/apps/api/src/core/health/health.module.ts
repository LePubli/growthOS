import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { 
  HealthCheck, 
  HealthCheckService, 
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
  HealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Injectable } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../shared/database/prisma.service';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

@Injectable()
export class CustomDiskHealthIndicator extends HealthIndicator {
  async checkStorage(key: string, options: { path: string; thresholdPercent: number }): Promise<HealthIndicatorResult> {
    try {
      // Utilisation de df pour récupérer l'espace disque (compatible Linux/Docker)
      const { stdout } = await execAsync(`df -P ${options.path} | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      const capacityPercent = parseInt(parts[4]) / 100;
      
      const isHealthy = capacityPercent < options.thresholdPercent;
      
      return super.getStatus(key, isHealthy, {
        path: options.path,
        usedPercent: capacityPercent,
        thresholdPercent: options.thresholdPercent,
      });
    } catch (error) {
      // Fallback: retourne healthy si on ne peut pas vérifier
      return super.getStatus(key, true, {
        path: options.path,
        message: 'Unable to check disk space',
      });
    }
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: CustomDiskHealthIndicator,
  ) {}
  
  @Get()
  @Public()
  @ApiOperation({ summary: 'Vérification complète de santé du service' })
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', (this.prismaIndicator as any).prisma),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.disk.checkStorage('storage', { path: '/app', thresholdPercent: 0.9 }),
    ]);
  }
  
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Vérification de readiness (démarrage complet)' })
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', (this.prismaIndicator as any).prisma),
    ]);
  }
  
  @Get('live')
  @Public()
  @ApiOperation({ summary: "Vérification de liveness (service en cours d'exécution)" })
  async live(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    TerminusModule,
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: PrismaHealthIndicator,
      useFactory: (prisma: PrismaService) => {
        const indicator = new PrismaHealthIndicator(null as any);
        (indicator as any).prisma = prisma;
        return indicator;
      },
      inject: [PrismaService],
    },
    MemoryHealthIndicator,
    CustomDiskHealthIndicator,
  ],
})
export class HealthModule {}
