import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DealsService, CreateDealDto } from './deals.service';

@Controller('api/v1/deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private readonly svc: DealsService) {}

  private tid(req: any) { return req.user?.tenantId || req.user?.tenant?.id; }

  @Get()
  findAll(@Request() req: any, @Query('stage') stage?: string) { return this.svc.findAll(this.tid(req), stage); }

  @Get('pipeline-stats')
  getPipelineStats(@Request() req: any) { return this.svc.getPipelineStats(this.tid(req)); }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) { return this.svc.findOne(id, this.tid(req)); }

  @Post()
  create(@Request() req: any, @Body() dto: CreateDealDto) { return this.svc.create(this.tid(req), dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: Partial<CreateDealDto>) {
    return this.svc.update(id, this.tid(req), dto);
  }

  @Post(':id/move')
  moveStage(@Param('id') id: string, @Request() req: any, @Body() body: { stage: string }) {
    return this.svc.moveStage(id, this.tid(req), body.stage);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) { return this.svc.remove(id, this.tid(req)); }
}
