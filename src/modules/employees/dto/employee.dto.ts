export class CreateEmployeeDto {
  emp_code: string;
  user_type_id: number;
  name: string;
  email: string;
  mobile: string;
  designation?: string;
  gender: string;
  password?: string;
  is_active?: number;
  audit_unit_authority?: string;
  admin_id?: number;
}

export class UpdateEmployeeDto {
  emp_code?: string;
  user_type_id?: number;
  name?: string;
  email?: string;
  mobile?: string;
  designation?: string;
  gender?: string;
  password?: string;
  is_active?: number;
  audit_unit_authority?: string;
  admin_id?: number;
}
