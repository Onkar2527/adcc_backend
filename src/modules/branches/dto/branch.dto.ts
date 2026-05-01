export class CreateBranchDto {
  branch_code: string;
  branch_name: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}

export class UpdateBranchDto {
  branch_code?: string;
  branch_name?: string;
  address?: string;
  contact_number?: string;
  is_active?: boolean;
}
