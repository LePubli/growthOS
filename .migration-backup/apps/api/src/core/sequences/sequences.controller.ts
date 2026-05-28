import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SequencesService, CreateSequenceDto } from './sequences.service';

@Controller('sequences')
@UseGuards(JwtAuthGuard)
export class SequencesController {
  constructor(private readonly svc: SequencesService) {}

  private tid(req: any) { return req.user?.tenantId || req.user?.tenant?.id; }

  @Get()    findAll(@Request() req: any) { return this.svc.findAll(this.tid(req)); }
  @Get(':id') findOne(@Param('id') id: string, @Request() req: any) { return this.svc.findOne(id, this.tid(req)); }
  @Post()   create(@Request() req: any, @Body() dto: CreateSequenceDto) { return this.svc.create(this.tid(req), dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req: any, @Body() dto: Partial<CreateSequenceDto>) {
    return this.svc.update(id, this.tid(req), dto);
  }

  @Post(':id/toggle')
  toggle(@Param('id') id: string, @Request() req: any) { return this.svc.toggle(id, this.tid(req)); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) { return this.svc.remove(id, this.tid(req)); }
}
