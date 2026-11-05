export class HrmEmployeeItemDto {
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  startDate?: string;
}

export class SyncHrmUsersDto {
  employeeCode?: string;
  fullName?: string;
  email?: string;
  position?: string;
  department?: string;
  startDate?: string;
  employees?: HrmEmployeeItemDto[];
}