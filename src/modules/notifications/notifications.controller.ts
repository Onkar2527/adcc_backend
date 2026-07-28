import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  private getUserId(query: GetNotificationsDto, req: any): number {
    // 1. If explicit query parameter is provided, trust it (matches the legacy pattern)
    if (query.employeeId && Number(query.employeeId) > 0) {
      return Number(query.employeeId);
    }

    // 2. Otherwise fall back to decoding authorization header Bearer token
    try {
      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
          const decoded = this.jwtService.verify(token);
          if (decoded && decoded.sub) {
            return Number(decoded.sub);
          }
        }
      }
    } catch (err) {
      // Silently fall through to check req.user or fail
    }

    // 3. Fall back to req.user set by potential global middlewares/guards
    if (req.user?.id) {
      return Number(req.user.id);
    }

    throw new UnauthorizedException('User identification is missing or invalid.');
  }

  @Get()
  async findAll(@Query() query: GetNotificationsDto, @Req() req: any) {
    const userId = this.getUserId(query, req);
    return this.service.findAll(userId);
  }

  @Put(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetNotificationsDto,
    @Req() req: any,
  ) {
    const userId = this.getUserId(query, req);
    return this.service.markAsRead(id, userId);
  }

  @Put('read-all')
  async markAllAsRead(@Query() query: GetNotificationsDto, @Req() req: any) {
    const userId = this.getUserId(query, req);
    return this.service.markAllAsRead(userId);
  }
}
