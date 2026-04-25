/**
 * RBAC capability map for Vexim Bridge — single source of truth.
 *
 * Roles (see migration 020):
 *   - super_admin       : Founder / system owner
 *   - admin             : Operations lead
 *   - account_executive : Sales rep (R-06: cannot touch cost_price)
 *   - lead_researcher   : Researcher (buyer PII must be masked)
 *   - finance           : Bookkeeper
 *   - staff (legacy)    : Treated as account_executive
 *   - client            : External portal user (not RBAC-enforced here)
 *
 * Usage:
 *   import { can, CAPS } from "@/lib/auth/permissions"
 *   if (!can(role, CAPS.INVOICE_WRITE)) return { ok: false, error: "forbidden" }
 */

import type { Role } from "@/lib/supabase/types"

// ---------------------------------------------------------------------------
// Capability catalog
// ---------------------------------------------------------------------------
// Grouped by domain so we can add/revoke permissions per-role predictably.
// NOTE: keep this flat — no nested booleans — so every call site is grep-able.
export const CAPS = {
  // --- Finance ---
  FINANCE_READ:                "finance:read",
  INVOICE_WRITE:               "finance:invoice:write",      // create, edit, send, mark paid
  INVOICE_VOID:                "finance:invoice:void",
  EXPENSE_WRITE:               "finance:expense:write",
  BILLING_PLAN_WRITE:          "finance:billing_plan:write",
  FINANCE_SETTINGS_WRITE:      "finance:settings:write",

  // --- Deals / Opportunities ---
  DEAL_VIEW:                   "deal:view",
  DEAL_COST_PRICE_WRITE:       "deal:cost_price:write",      // R-06: AE is BLOCKED
  DEAL_SELLING_PRICE_WRITE:    "deal:selling_price:write",
  DEAL_QUANTITY_WRITE:         "deal:quantity:write",
  DEAL_COMPLIANCE_WRITE:       "deal:compliance:write",      // upload docs, FDA status

  // --- Buyers ---
  BUYER_VIEW:                  "buyer:view",
  BUYER_PII_VIEW:              "buyer:pii:view",             // email/phone unmasked
  BUYER_WRITE:                 "buyer:write",

  // --- Clients ---
  CLIENT_VIEW:                 "client:view",
  CLIENT_WRITE:                "client:write",
  CLIENT_COMPLIANCE_WRITE:     "client:compliance:write",

  // --- Country risk ---
  COUNTRY_RISK_READ:           "country_risk:read",
  COUNTRY_RISK_WRITE:          "country_risk:write",

  // --- User admin ---
  USERS_VIEW:                  "admin:users:view",
  USERS_MANAGE:                "admin:users:manage",         // create, disable, reset
  USERS_ASSIGN_ROLE:           "admin:users:assign_role",    // change profile.role

  // --- System / audit ---
  ACTIVITY_LOG_VIEW:           "system:activity_log:view",
  NOTIFICATIONS_MANAGE:        "system:notifications:manage",

  // --- Analytics / Reporting (added in 029) ---
  // VIEW_ALL — see every client's history (admin/super_admin/finance).
  // VIEW_OWN — see only clients where profiles.account_manager_id = current user
  //            (account_executive / lead_researcher).
  ANALYTICS_VIEW_ALL:          "analytics:view:all",
  ANALYTICS_VIEW_OWN:          "analytics:view:own",
} as const

export type Capability = (typeof CAPS)[keyof typeof CAPS]

// ---------------------------------------------------------------------------
// Role -> capability set
// ---------------------------------------------------------------------------
// Order matters for readability only. `super_admin` has everything; every
// other role is whitelisted explicitly so an accidental new capability
// defaults to DENY.
const ALL_CAPS: readonly Capability[] = Object.values(CAPS)

const ROLE_CAPS: Record<Role, readonly Capability[]> = {
  // super_admin: full system access, including the exclusive right to
  // promote/demote other super_admins (enforced in app/admin/users/actions.ts).
  super_admin: ALL_CAPS,

  // admin: same capability set as super_admin for day-to-day operations.
  // The only super_admin-exclusive actions are:
  //   1. Promote a user TO super_admin
  //   2. Demote / modify an existing super_admin
  // Both are enforced in the users action layer, not via capabilities,
  // so the rest of the system works without requiring super_admin approval.
  admin: ALL_CAPS,

  account_executive: [
    // Deals — R-06: cost_price is BLOCKED for AE
    CAPS.DEAL_VIEW,
    CAPS.DEAL_SELLING_PRICE_WRITE,
    CAPS.DEAL_QUANTITY_WRITE,
    CAPS.DEAL_COMPLIANCE_WRITE,

    // Buyers — full visibility including PII
    CAPS.BUYER_VIEW,
    CAPS.BUYER_PII_VIEW,
    CAPS.BUYER_WRITE,

    // Clients
    CAPS.CLIENT_VIEW,
    CAPS.CLIENT_WRITE,
    CAPS.CLIENT_COMPLIANCE_WRITE,

    // Read-only signals
    CAPS.COUNTRY_RISK_READ,
    CAPS.FINANCE_READ,

    // Analytics — scoped to assigned clients only.
    CAPS.ANALYTICS_VIEW_OWN,
  ],

  lead_researcher: [
    // Buyers — WRITE allowed, but PII VIEW is denied → UI must mask.
    CAPS.BUYER_VIEW,
    CAPS.BUYER_WRITE,

    // Research context
    CAPS.DEAL_VIEW,
    CAPS.CLIENT_VIEW,
    CAPS.COUNTRY_RISK_READ,

    // Analytics — scoped to assigned clients only.
    CAPS.ANALYTICS_VIEW_OWN,
  ],

  finance: [
    CAPS.FINANCE_READ,
    CAPS.INVOICE_WRITE,
    CAPS.INVOICE_VOID,
    CAPS.EXPENSE_WRITE,
    CAPS.BILLING_PLAN_WRITE,
    CAPS.FINANCE_SETTINGS_WRITE,

    // Needs to see deals/clients to issue invoices
    CAPS.DEAL_VIEW,
    CAPS.CLIENT_VIEW,
    CAPS.BUYER_VIEW,

    // Finance team needs full revenue / win-rate visibility for forecasting.
    CAPS.ANALYTICS_VIEW_ALL,
  ],

  // Legacy — treat as account_executive.
  staff: [
    CAPS.DEAL_VIEW,
    CAPS.DEAL_SELLING_PRICE_WRITE,
    CAPS.DEAL_QUANTITY_WRITE,
    CAPS.DEAL_COMPLIANCE_WRITE,
    CAPS.BUYER_VIEW,
    CAPS.BUYER_PII_VIEW,
    CAPS.BUYER_WRITE,
    CAPS.CLIENT_VIEW,
    CAPS.CLIENT_WRITE,
    CAPS.CLIENT_COMPLIANCE_WRITE,
    CAPS.COUNTRY_RISK_READ,
    CAPS.FINANCE_READ,
    CAPS.ANALYTICS_VIEW_OWN,
  ],

  // Portal user — not enforced via capabilities here.
  client: [],
} as const

// Freeze the inner arrays to prevent accidental mutation at runtime.
for (const role of Object.keys(ROLE_CAPS) as Role[]) {
  Object.freeze(ROLE_CAPS[role])
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalise a raw role string (e.g. from DB) into a known Role.
 * Returns `null` if the value is not recognised.
 */
export function normaliseRole(raw: string | null | undefined): Role | null {
  if (!raw) return null
  const known: Role[] = [
    "super_admin",
    "admin",
    "account_executive",
    "lead_researcher",
    "finance",
    "staff",
    "client",
  ]
  return known.includes(raw as Role) ? (raw as Role) : null
}

/**
 * Roles allowed into the `/admin` shell. Mirrors app/admin/layout.tsx.
 * `client` is the only non-admin role — everyone else goes to /admin.
 */
const ADMIN_SHELL_ROLES: readonly Role[] = [
  "super_admin",
  "admin",
  "account_executive",
  "lead_researcher",
  "finance",
  "staff",
]

/** True iff the role is allowed into the /admin shell. */
export function isAdminShellRole(role: Role | null | undefined): boolean {
  if (!role) return false
  return ADMIN_SHELL_ROLES.includes(role)
}

/**
 * Resolve the post-login landing URL for a role. Unknown / client roles
 * land in the customer portal; every staff role goes to /admin.
 */
export function landingPathForRole(role: Role | null | undefined): "/admin" | "/client" {
  return isAdminShellRole(role) ? "/admin" : "/client"
}

/** True iff the given role has the capability. */
export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false
  const caps = ROLE_CAPS[role]
  return caps ? caps.includes(cap) : false
}

/** True iff the role has ANY of the capabilities (OR). */
export function canAny(role: Role | null | undefined, caps: Capability[]): boolean {
  return caps.some((c) => can(role, c))
}

/** True iff the role has ALL of the capabilities (AND). */
export function canAll(role: Role | null | undefined, caps: Capability[]): boolean {
  return caps.every((c) => can(role, c))
}

/** List the capabilities granted to a role (useful for UI). */
export function capabilitiesOf(role: Role | null | undefined): readonly Capability[] {
  if (!role) return []
  return ROLE_CAPS[role] ?? []
}

// ---------------------------------------------------------------------------
// Human-readable role metadata — consumed by /admin/users and the sidebar.
// ---------------------------------------------------------------------------
export interface RoleMeta {
  value: Role
  label: string       // English label
  labelVi: string     // Vietnamese label
  description: string
  /** When true, hidden from the "assign role" dropdown for non-super_admin. */
  restricted?: boolean
  /** When true, treated as legacy — shown only if current user already has it. */
  legacy?: boolean
}

export const ROLE_META: Record<Role, RoleMeta> = {
  super_admin: {
    value: "super_admin",
    label: "Super Admin",
    labelVi: "Super Admin",
    description: "Founder / full system access",
    restricted: true,
  },
  admin: {
    value: "admin",
    label: "Admin",
    labelVi: "Quản trị",
    description: "Operations lead, full day-to-day access",
  },
  account_executive: {
    value: "account_executive",
    label: "Account Executive",
    labelVi: "Account Executive",
    description: "Sales — manages deals & buyers (cannot edit cost price)",
  },
  lead_researcher: {
    value: "lead_researcher",
    label: "Lead Researcher",
    labelVi: "Lead Researcher",
    description: "Sources buyers — buyer contact info is masked",
  },
  finance: {
    value: "finance",
    label: "Finance",
    labelVi: "Kế toán",
    description: "Invoices, expenses, billing plans",
  },
  staff: {
    value: "staff",
    label: "Staff (legacy)",
    labelVi: "Staff (legacy)",
    description: "Legacy role — treated as Account Executive",
    legacy: true,
  },
  client: {
    value: "client",
    label: "Client",
    labelVi: "Khách hàng",
    description: "External client portal user",
  },
}

/** Roles that can be assigned via the /admin/users UI. */
export function assignableRoles(currentUserRole: Role | null | undefined): RoleMeta[] {
  const isSuper = currentUserRole === "super_admin"
  return Object.values(ROLE_META).filter((m) => {
    if (m.legacy) return false
    if (m.value === "client") return false
    if (m.restricted && !isSuper) return false
    return true
  })
}
