import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  async findAll() {
    this.logger.log('findAll tenants');
    return [];
  }

  async findOne(id: string) {
    this.logger.log(`findOne tenant id=${id}`);
    return { id };
  }

  async findBySlug(slug: string) {
    this.logger.log(`findBySlug slug=${slug}`);
    return null;
  }

  async create(data: any) {
    this.logger.log(`create tenant ${JSON.stringify(data)}`);
    return data;
  }
}
