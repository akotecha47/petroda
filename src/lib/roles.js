export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
}

export const ROLE_LABELS = {
  owner: 'Master',
  admin: 'Admin',
  manager: 'Station Manager',
}

export const canAccess = {
  reconciliation: ['owner', 'admin'],
  flags: ['owner', 'admin'],
  reports: ['owner', 'admin'],
  config: ['owner'],
  userManagement: ['owner', 'admin'],
  customers: ['owner', 'admin'],
  deliveryIssue: ['admin'],
  dataEntry: ['manager'],
}
