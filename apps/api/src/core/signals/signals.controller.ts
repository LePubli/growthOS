import {
  Controller, Get, Post, Patch,
  Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SignalsService } from './signals.service';

@Controller('api/v1/signals')
@UseGuards(JwtAuthGuard)
export class SignalsController {
  constructor(private readonly svc: SignalsService) {}

  private tid(req: any) { return req.user?.tenantId || req.user?.tenant?.id; }

  @Get()
  findAll(@Request() req: any, @Query('type') type?: string, @Query('unread') unread?: string) {
    return this.svc.findAll(this.tid(req), { type, unread: unread === 'true' });
  }

  @Get('stats')
  getStats(@Request() req: any) { return this.svc.getStats(this.tid(req)); }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Request() req: any) { return this.svc.markRead(id, this.tid(req)); }

  @Post('read-all')
  markAllRead(@Request() req: any) { return this.svc.markAllRead(this.tid(req)); }
}
