/**
 * Hospital Emergency Coordination Dataset Module
 * Provides unified access to schemas, fixtures, and seed data.
 */

const fs = require('fs');
const path = require('path');

function readJsonFile(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

module.exports = {
  // Seed datasets
  getHospitals: () => readJsonFile('seed/hospitals.json'),
  getStaff: () => readJsonFile('seed/staff.json'),
  getCases: () => readJsonFile('seed/cases.json'),
  getCapacity: () => readJsonFile('seed/capacity.json'),
  getResources: () => readJsonFile('seed/resources.json'),
  getQuickTemplates: () => readJsonFile('seed/quick_templates.json'),
  getAuditLogs: () => readJsonFile('seed/audit_logs.json'),

  // Schema definitions
  schemas: {
    hospital: () => readJsonFile('schemas/hospital.schema.json'),
    case: () => readJsonFile('schemas/case.schema.json'),
    capacity: () => readJsonFile('schemas/capacity.schema.json'),
    audit: () => readJsonFile('schemas/audit.schema.json')
  }
};
