import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(5000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // Auth & Security
  JWT_SECRET: Joi.string()
    .min(16)
    .default('novatech-lms-super-secret-jwt-key-2026-dev'),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),

  // API & CORS
  CORS_ORIGINS: Joi.string().default(
    'http://localhost:3000,http://127.0.0.1:3000',
  ),
  RESPONSE_ENVELOPE: Joi.boolean().default(false),

  // HRM & Onboarding
  HRM_API_KEY: Joi.string().default('novatech-hrm-secret-api-key-2026'),
  HRM_INTEGRATION_ENABLED: Joi.boolean().default(true),
  ONBOARDING_PATH_CODE: Joi.string().default('path-fresher-java'),
  ONBOARDING_DEADLINE_DAYS: Joi.number().integer().min(1).default(30),

  // Business Rules (BR-01, BR-02, LP)
  PATH_REQUIRED_UNITS: Joi.number().integer().min(1).default(4),
  STRICT_LESSON_ORDER: Joi.boolean().default(false),
  QUIZ_PASS_MIN: Joi.number().min(70).max(100).default(70),
  COMPETENCY_PROFICIENT_MIN: Joi.number().min(0).max(100).default(70),
  COMPETENCY_ADVANCED_MIN: Joi.number().min(0).max(100).default(90),

  // File Upload & Notifications
  UPLOAD_DIR: Joi.string().default('./uploads'),
  MAX_UPLOAD_MB: Joi.number().integer().min(1).default(20),
  REMINDER_CRON: Joi.string().default('0 8 * * *'),
  TZ: Joi.string().default('Asia/Ho_Chi_Minh'),
  SEED_DEMO_PASSWORD: Joi.string().default('Password123!'),
});

