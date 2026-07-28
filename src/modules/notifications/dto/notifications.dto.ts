import { IsOptional, IsString } from 'class-validator';

export class GetNotificationsDto {
  @IsOptional()
  @IsString()
  employeeId?: string;
}
