export class CreateRoleDto {
  role_name: string;
  description?: string;
  is_active?: boolean;
}

export class UpdateRoleDto {
  role_name?: string;
  description?: string;
  is_active?: boolean;
}
