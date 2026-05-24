import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProspectsService, CreateProspectDto } from './prospects.service';

@Controller('api/v1/prospects')
@UseGuards(JwtAuthGuard)
export class ProspectsController {
  constructor(private readonly svc: ProspectsService) {}

  private tid(req: any) { return req.user?.tenantId || req.user?.tenant?.id; }

  @Get()
  findAll(@Request() req: any,
    @Query('search') search?: string, @Query('status') status?: string,
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('orderBy') orderBy?: string, @Query('order') order?: 'asc' | 'desc') {
    return this.svc.findAll(this.tid(req), {
      search, status, orderBy, order,
      page: page ? +page : 1, limit: limit ? +limit : 50,
    });
  }

  @Get('stats')
  getStats(@Request() req: any) { return this.svc.getStats(this.tid(req)); }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) { return this.svc.findOne(id, this.tid(req)); }

  @Post()
  create(@Request() req: any, @Body() dto: CreateProspectDto) { return this.svc.create(this.tid(req), dto); }

  @Post('bulk')
  bulkCreate(@Request() req: any, @Body() body: { prospects: CreateProspectDto[] }) {
    return this.svc.bulkCreate(this.tid(req), body.prospects);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: Partial<CreateProspectDto>) {
    return this.svc.update(id, this.tid(req), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) { return this.svc.remove(id, this.tid(req)); }
}
