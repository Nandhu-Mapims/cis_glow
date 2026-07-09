import { config } from '../config.js';
import { assertOk } from '../lib/assert.js';

/** Generate a unique staff ID for create tests (prefix TST). */
export function mockStaffId() {
  return `TST${Date.now().toString().slice(-7)}`;
}

/** Generate a unique student admission number for create tests. */
export function mockStudentId() {
  return `STU${Date.now().toString().slice(-7)}`;
}

/** Minimal staff admission payload — department/designation filled at runtime from options API. */
export function buildStaffAdmissionPayload(overrides = {}) {
  return {
    staffId: mockStaffId(),
    staffName: 'CRUD Test Staff',
    title: 'Mr',
    gender: 'Male',
    joinedDate: new Date().toISOString().slice(0, 10),
    education: [],
    experience: [],
    activities: {},
    ...overrides,
  };
}

/**
 * Resolve department, designation, and job category from admission APIs.
 * Designations are per-department — not included in /admission/options.
 */
export async function resolveAdmissionFields(client) {
  const optionsRes = await client.get('/api/staff/admission/options');
  assertOk(optionsRes, 'admission options');

  const options = optionsRes.data;
  const department = options?.departments?.[0];
  if (!department?.id) {
    throw new Error('No departments in admission options');
  }

  const desRes = await client.get(
    `/api/staff/admission/designations?departmentId=${encodeURIComponent(department.id)}`,
  );
  assertOk(desRes, 'designations');
  const designation = desRes.data?.designations?.[0];
  if (!designation?.id) {
    throw new Error(`No designations for department ${department.id}`);
  }

  const jobCategory = options?.categories?.[0]?.id || '1';

  return {
    departmentId: String(department.id),
    designationId: String(designation.id),
    jobCategory: String(jobCategory),
  };
}

export const knownIds = {
  staffInternalId: config.staffId,
  staffDisplayId: config.staffDisplayId,
  studentInternalId: config.studentId,
};
