import 'dotenv/config';
import { PrismaClient, RoleCode, PositionLevel } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Bắt đầu chạy seed dữ liệu nền...');

  // 1. Seed 4 Roles (Idempotent upsert)
  const roleCodes: RoleCode[] = [
    RoleCode.EMPLOYEE,
    RoleCode.TRAINER,
    RoleCode.HR,
    RoleCode.ADMIN,
  ];

  const roleMap = new Map<RoleCode, number>();

  for (const code of roleCodes) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    roleMap.set(code, role.id);
    console.log(`  ✓ Role [${code}] id: ${role.id}`);
  }

  // 2. Hash mật khẩu demo mặc định
  const rawPassword = process.env.SEED_DEMO_PASSWORD || 'Password123!';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // 3. Seed Demo Users
  const demoUsers = [
    {
      email: 'admin@novatech.com',
      fullName: 'Quản Trị Viên Hệ Thống',
      roleCode: RoleCode.ADMIN,
      position: PositionLevel.LEAD,
      department: 'Ban Giám Đốc',
      employeeCode: 'ADMIN001',
    },
    {
      email: 'hr@novatech.com',
      fullName: 'Chuyên Viên Nhân Sự',
      roleCode: RoleCode.HR,
      position: PositionLevel.SENIOR,
      department: 'Phòng Nhân Sự',
      employeeCode: 'HR001',
    },
    {
      email: 'trainer@novatech.com',
      fullName: 'Đào Tạo Viên NovaTech',
      roleCode: RoleCode.TRAINER,
      position: PositionLevel.SENIOR,
      department: 'Phòng Đào Tạo & Phát Triển',
      employeeCode: 'TR001',
    },
    {
      email: 'fresher.java@novatech.com',
      fullName: 'Nguyễn Văn Fresher Java',
      roleCode: RoleCode.EMPLOYEE,
      position: PositionLevel.FRESHER,
      department: 'Trung Tâm Phát Triển Phần Mềm',
      employeeCode: 'NV001',
      jobTitle: 'Fresher Backend Java',
    },
    {
      email: 'huan.nguyen@novatech.com',
      fullName: 'Nguyễn Văn Huân',
      roleCode: RoleCode.EMPLOYEE,
      position: PositionLevel.JUNIOR,
      department: 'Trung Tâm Phát Triển Phần Mềm',
      employeeCode: 'NV002',
      jobTitle: 'Junior Backend Developer',
    },
  ];

  for (const u of demoUsers) {
    const roleId = roleMap.get(u.roleCode)!;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        roleId,
        position: u.position,
        department: u.department,
        employeeCode: u.employeeCode,
        jobTitle: u.jobTitle,
        isActive: true,
      },
      create: {
        email: u.email,
        password: hashedPassword,
        fullName: u.fullName,
        roleId,
        position: u.position,
        department: u.department,
        employeeCode: u.employeeCode,
        jobTitle: u.jobTitle,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`  ✓ User [${u.email}] (${u.roleCode}) - id: ${user.id}`);
  }

  console.log('✅ Seed dữ liệu nền thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

