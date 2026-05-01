export class CreateLoanTypeDto {
  type_code: string;
  type_name: string;
  description?: string;
  interest_rate?: number;
  max_tenure_months?: number;
  is_active?: boolean;
}

export class UpdateLoanTypeDto {
  type_code?: string;
  type_name?: string;
  description?: string;
  interest_rate?: number;
  max_tenure_months?: number;
  is_active?: boolean;
}
