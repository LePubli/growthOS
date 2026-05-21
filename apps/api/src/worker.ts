/**
 * Worker standalone GrowthOS
 * Traite les jobs BullMQ en arrière-plan :
 * - events (webhooks, workflows)
 * - workflows (exécution steps)
 * - plugins (migrations)
 * - emails (séquences)
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const logger = new Logger('Worker');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.log('🔧 GrowthOS Worker démarré — en attente de jobs...');
  logger.log('Queues actives : events, workflows, plugins');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM reçu — arrêt gracieux...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrapWorker();
