import { Module } from '@nestjs/common';
import { ThemesController } from './themes.controller';
import { ThemeEngineService } from './theme-engine.service';
import { ThemesService } from './themes.service';

@Module({
  controllers: [ThemesController],
  providers: [ThemeEngineService, ThemesService],
  exports: [ThemeEngineService],
})
export class ThemesModule {}
