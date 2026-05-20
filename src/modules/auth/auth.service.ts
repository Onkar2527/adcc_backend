import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {

  const user = await this.usersService.findByUsername(username);

  if (!user) return null;

  const isValid =
    user.password_hash
      ? await bcrypt.compare(pass, user.password)
      : pass === user.password;

  if (!isValid) return null;

  const { password_hash, password, ...result } = user;

  return result;
}

  async login(username: string, pass: string) {
    const user = await this.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      username: user.username, 
      sub: user.id,
      fullName: user.full_name,
      roleId: user.role_id,
      branchId: user.branch_id
    };



    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        user_type_id: user.user_type_id,
        emp_code: user.emp_code,
        designation: user.designation,
        audit_unit_authority: user.audit_unit_authority 

      }
    };
  }
}
