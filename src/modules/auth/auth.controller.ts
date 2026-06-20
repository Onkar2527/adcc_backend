import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any, @Req() req: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    return this.authService.login(body.username, body.password, ipAddress);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: any, @Req() req: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    await this.authService.logout(Number(body?.employee_id || 0), ipAddress);
    return { success: true };
  }
}
