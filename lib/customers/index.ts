/**
 * Customers Module
 *
 * Central export for all customer-related functionality.
 */

// Types
export type {
  Customer,
  Address,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFilters,
  CustomerMatch,
  ErpSyncStatus,
} from '@/types/customers'
export { isErpSyncStatus } from '@/types/customers'

// Queries (read operations)
export {
  getCustomers,
  getCustomer,
  searchCustomers,
  getCustomerByEmail,
  getCustomerByName,
  getCustomerOrders,
  countCustomerOrders,
  getCustomersForMatching,
} from './queries'

// Actions (mutations)
export {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  reactivateCustomer,
  setOrderCustomer,
  unlinkOrderCustomer,
  createCustomerAndLinkToOrder,
} from './actions'

// Services (business logic)
export {
  calculateStringSimilarity,
  normalizeCompanyName,
  emailsMatch,
  extractEmailDomain,
  findCustomerMatches,
  isConfidentMatch,
  formatCustomerDisplayName,
  formatCurrency,
  formatDate,
  getErpSyncStatusDisplay,
  validateCustomerName,
  validateEmail,
  validatePhone,
} from './services'

// Matching
export {
  matchCustomerForOrder,
  findSimilarCustomers,
  getMatchExplanation,
  requiresCustomerConfirmation,
  type CustomerMatchResult,
} from './matching'

// Backfill (admin operations)
export {
  backfillCustomersFromOrders,
  previewCustomerBackfill,
} from './backfill'
