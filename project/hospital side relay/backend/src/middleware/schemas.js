/**
 * Zod Validation Schemas for Hospital Emergency Relay
 * Strict schema validation enforcing:
 * - Allowed enum values
 * - String length limits
 * - Number ranges
 * - Rejection of unknown fields (.strict())
 */

const { z } = require('zod');

// URL ID parameter schema
const idParamSchema = z.object({
  id: z.string({ required_error: 'ID parameter is required' })
    .min(1, 'ID cannot be empty')
    .max(64, 'ID cannot exceed 64 characters')
    .regex(/^[a-zA-Z0-9_\-]+$/, 'ID must contain only alphanumeric characters, dashes, or underscores')
}).strict();

// Resource category & ID parameter schema
const resourceParamSchema = z.object({
  category: z.enum(['specialists', 'equipment', 'blood_products'], {
    errorMap: () => ({ message: "Category must be specialists, equipment, or blood_products" })
  }),
  id: z.string({ required_error: 'ID parameter is required' })
    .min(1, 'ID cannot be empty')
    .max(64, 'ID cannot exceed 64 characters')
    .regex(/^[a-zA-Z0-9_\-]+$/, 'ID must contain only alphanumeric characters, dashes, or underscores')
}).strict();

// Case creation schema (paramedic ingest)
const createCaseSchema = z.object({
  case_id: z.string().min(1).max(64).optional(),
  idempotency_key: z.string().min(1).max(128).optional(),
  version: z.number().int().min(1).max(1000).optional(),
  hospital_id: z.string().min(1).max(64).optional(),
  source: z.enum(['TRIAGE_RELAY']).optional(),
  submitted_at: z.string().max(64).optional(),
  received_at: z.string().max(64).nullable().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], {
    errorMap: () => ({ message: "Priority must be CRITICAL, HIGH, MEDIUM or LOW" })
  }),
  emergency_type: z.string({ required_error: 'emergency_type is required' })
    .min(1, 'emergency_type cannot be empty')
    .max(255, 'emergency_type cannot exceed 255 characters'),
  patient_condition_summary: z.string().max(1000, 'patient_condition_summary cannot exceed 1000 characters').optional(),
  patient: z.object({
    age: z.number().int().min(0, 'age must be >= 0').max(150, 'age cannot exceed 150').nullable().optional(),
    age_group: z.string().max(50).nullable().optional(),
    sex: z.string().max(20).nullable().optional(),
    identifier: z.string().max(100).nullable().optional()
  }).strict().optional(),
  vital_signs: z.array(z.object({
    type: z.string().min(1).max(100),
    value: z.union([
      z.number().min(-100).max(1000),
      z.string().max(50)
    ]),
    unit: z.string().max(30),
    measured_at: z.string().max(64)
  }).strict()).optional(),
  notes: z.string().max(5000, 'notes cannot exceed 5000 characters').optional(),
  treatment_given: z.string().max(5000, 'treatment_given cannot exceed 5000 characters').nullable().optional(),
  paramedic: z.object({
    unit_id: z.string().min(1).max(50),
    name_or_code: z.string().max(100).optional(),
    callback_phone: z.string().max(50).optional()
  }).strict().optional(),
  eta: z.string().max(64).optional(),
  eta_minutes: z.number().min(0).max(1440).optional(),
  delivery_state: z.enum(['DELIVERING', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED']).optional(),
  response_status: z.enum(['NEW', 'RECEIVED', 'PREPARING', 'READY', 'UNABLE_TO_RECEIVE', 'PATIENT_ARRIVED', 'HANDOVER_COMPLETE']).optional(),
  resources_requested: z.array(z.object({
    type: z.string().max(100),
    detail: z.string().max(255),
    status: z.string().max(50).optional()
  }).strict()).optional(),
  instructions_to_paramedic: z.string().max(2000).nullable().optional(),
  unable_to_receive_reason: z.object({
    reason_code: z.enum(['NO_CAPACITY', 'RESOURCE_UNAVAILABLE', 'DIVERSION', 'OTHER']),
    reason_note: z.string().max(500).optional()
  }).strict().nullable().optional(),
  timeline: z.array(z.object({
    timestamp: z.string().max(64).optional(),
    actor: z.string().max(100).optional(),
    action: z.string().max(100).optional(),
    detail: z.string().max(500).optional()
  }).strict()).optional()
}).strict();

// Case acknowledge schema
const acknowledgeCaseSchema = z.object({}).strict();

// Case status update schema
const caseStatusSchema = z.object({
  status: z.enum(['NEW', 'RECEIVED', 'PREPARING', 'READY', 'UNABLE_TO_RECEIVE', 'PATIENT_ARRIVED', 'HANDOVER_COMPLETE', 'CANCELLED'], {
    errorMap: () => ({ message: "Status must be a valid response status" })
  }),
  reason_code: z.enum(['NO_CAPACITY', 'RESOURCE_UNAVAILABLE', 'DIVERSION', 'OTHER']).optional(),
  reason_note: z.string().max(500, 'reason_note cannot exceed 500 characters').optional()
}).strict();

// Case instructions schema
const caseInstructionsSchema = z.object({
  instruction: z.string().max(2000, 'instruction cannot exceed 2000 characters').optional(),
  resources: z.array(z.object({
    type: z.string().max(100),
    detail: z.string().max(255),
    status: z.string().max(50).optional()
  }).strict()).optional()
}).strict();

// Capacity update schema
const capacityUpdateSchema = z.object({
  available_beds: z.number({ required_error: 'available_beds is required' }).int().min(0, 'available_beds must be >= 0').max(10000, 'available_beds cannot exceed 10000'),
  occupied_beds: z.number({ required_error: 'occupied_beds is required' }).int().min(0, 'occupied_beds must be >= 0').max(10000, 'occupied_beds cannot exceed 10000'),
  total_beds: z.number().int().min(1, 'total_beds must be >= 1').max(10000, 'total_beds cannot exceed 10000').optional(),
  icu_beds_vacant: z.number({ required_error: 'icu_beds_vacant is required' }).int().min(0, 'icu_beds_vacant must be >= 0').max(1000, 'icu_beds_vacant cannot exceed 1000'),
  icu_beds_total: z.number().int().min(1, 'icu_beds_total must be >= 1').max(1000, 'icu_beds_total cannot exceed 1000').optional(),
  operating_theaters_available: z.number({ required_error: 'operating_theaters_available is required' }).int().min(0, 'operating_theaters_available must be >= 0').max(100, 'operating_theaters_available cannot exceed 100'),
  operating_theaters_total: z.number().int().min(1, 'operating_theaters_total must be >= 1').max(100, 'operating_theaters_total cannot exceed 100').optional(),
  trauma_bays_available: z.number().int().min(0, 'trauma_bays_available must be >= 0').max(100, 'trauma_bays_available cannot exceed 100').optional(),
  trauma_bays_total: z.number().int().min(1, 'trauma_bays_total must be >= 1').max(100, 'trauma_bays_total cannot exceed 100').optional()
}).strict();

// Capacity confirm schema
const capacityConfirmSchema = z.object({}).strict();

// Resource update schema
const resourceUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  physician: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  contact_ext: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  is_available: z.boolean().optional(),
  quantity_available: z.number().int().min(0).max(1000).optional(),
  quantity_total: z.number().int().min(0).max(1000).optional(),
  notes: z.string().max(500).optional(),
  label: z.string().max(100).optional(),
  units_available: z.number().int().min(0).max(1000).optional()
}).strict();

// Hospital profile update schema
const hospitalUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().max(100).optional(),
  address: z.object({
    street: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    region: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(10).optional()
  }).strict().optional(),
  departments: z.array(z.object({
    name: z.string().max(100),
    is_emergency_service: z.boolean().optional()
  }).strict()).optional(),
  verified_by: z.string().max(255).optional(),
  relay_code: z.string().max(50).optional()
}).strict();

// Staff invitation schema
const staffInviteSchema = z.object({
  full_name: z.string({ required_error: 'full_name is required' })
    .min(1, 'full_name cannot be empty')
    .max(100, 'full_name cannot exceed 100 characters'),
  email: z.string({ required_error: 'email is required' })
    .email('Valid email is required')
    .max(100, 'email cannot exceed 100 characters'),
  role: z.enum(['ADMIN', 'EMERGENCY_STAFF', 'CAPACITY_COORDINATOR', 'VIEWER_AUDITOR']).optional(),
  title: z.string().max(100, 'title cannot exceed 100 characters').optional()
}).strict();

// Staff update schema
const staffUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(100).optional(),
  role: z.enum(['ADMIN', 'EMERGENCY_STAFF', 'CAPACITY_COORDINATOR', 'VIEWER_AUDITOR']).optional(),
  title: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'DEACTIVATED']).optional(),
  second_factor_enabled: z.boolean().optional()
}).strict();

// Simulator send-case schema
const simulatorSendCaseSchema = z.object({
  preset: z.enum(['TRAUMA', 'CARDIAC', 'STROKE', 'PEDIATRIC']).optional(),
  custom: z.object({
    priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    emergency_type: z.string().min(1).max(255).optional(),
    patient_condition_summary: z.string().max(1000).optional(),
    eta_minutes: z.number().int().min(1).max(1440).optional(),
    vital_signs: z.array(z.object({
      type: z.string().max(100),
      value: z.union([z.number(), z.string().max(50)]),
      unit: z.string().max(30),
      measured_at: z.string().max(64)
    }).strict()).optional(),
    paramedic: z.object({
      unit_id: z.string().max(50),
      name_or_code: z.string().max(100).optional(),
      callback_phone: z.string().max(50).optional()
    }).strict().optional(),
    notes: z.string().max(5000).optional(),
    treatment_given: z.string().max(5000).optional()
  }).strict().optional()
}).strict();

// Simulator cancel-case schema
const simulatorCancelCaseSchema = z.object({
  case_id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  reason: z.string().max(500).optional()
}).strict();

// Simulator reset schema
const simulatorResetSchema = z.object({}).strict();

module.exports = {
  idParamSchema,
  resourceParamSchema,
  createCaseSchema,
  acknowledgeCaseSchema,
  caseStatusSchema,
  caseInstructionsSchema,
  capacityUpdateSchema,
  capacityConfirmSchema,
  resourceUpdateSchema,
  hospitalUpdateSchema,
  staffInviteSchema,
  staffUpdateSchema,
  simulatorSendCaseSchema,
  simulatorCancelCaseSchema,
  simulatorResetSchema
};
