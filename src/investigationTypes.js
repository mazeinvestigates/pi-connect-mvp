// Single source of truth for investigation types across the entire app.
// Used in: JobsPage, PostJobPage, SearchPage, ProfileEditPage, SubcontractModal, ReferralModal

export const INVESTIGATION_TYPES = [
  'Surveillance',
  'Background Investigation',
  'Fraud Investigation',
  'Missing Person',
  'Infidelity Investigation',
  'Corporate Investigation',
  'Insurance Investigation',
  'Skip Tracing',
  'Cyber Investigation',
  'Asset Investigation',
  'Workers Compensation',
  'Domestic Investigation',
]

// With "All Types" prefix for filter dropdowns
export const INVESTIGATION_TYPES_WITH_ALL = ['All Types', ...INVESTIGATION_TYPES]
