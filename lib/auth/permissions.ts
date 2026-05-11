/**
 * RBAC capability map for Vexim Trade — single source of truth.
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
  // BUYER_MANUAL_INTAKE — access to the legacy manual-intake screens that
  // let a user create/import buyers and assign them DIRECTLY to a client,
  // bypassing AI matching (`runMatchingPipeline` → `ae_match_inbox`).
  // Granted ONLY to lead_researcher (sources buyers when no ImportYeti
  // source) and super_admin (system owner). Account executives MUST go
  // through the AI inbox instead — they cannot self-assign buyers.
  BUYER_MANUAL_INTAKE:         "buyer:manual_intake",
  // MATCH_INBOX_VIEW — see the AI matching inbox (`/admin/ae-inbox`)
  // where the orchestrator pushes buyers ranked for the current AE.
  // This is the *primary* workflow for account_executive; admin /
  // super_admin / lead_researcher also need it for oversight & QA.
  // Finance and staff are intentionally excluded.
  MATCH_INBOX_VIEW:            "match:inbox:view",

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

  // --- SLA tracking (added in 031) ---
  // SLA_VIEW_ALL — see SLA performance for every client (admin/finance).
  // SLA_VIEW_OWN — see SLA only for clients where profiles.account_manager_id
  //                = current user (AE / Lead Researcher).
  // SLA_TARGET_WRITE — edit per-plan target rows + global defaults.
  // SLA_HOLIDAY_WRITE — manage public holiday calendar.
  // SLA_RUN_TRIGGER — kick off an evaluation re-run from the admin UI.
  SLA_VIEW_ALL:                "sla:view:all",
  SLA_VIEW_OWN:                "sla:view:own",
  SLA_TARGET_WRITE:            "sla:target:write",
  SLA_HOLIDAY_WRITE:           "sla:holiday:write",
  SLA_RUN_TRIGGER:             "sla:run:trigger",

  // --- Ownership scope (added in 035) ---
  // OWNERSHIP_BYPASS — when granted, the user sees & edits ALL clients,
  //   opportunities, deals, activities, regardless of the
  //   `profiles.account_manager_id` (live) and
  //   `opportunities.account_manager_id` (snapshot) columns.
  //
  //   Roles that get bypass: super_admin, admin, finance.
  //   Roles WITHOUT bypass — account_executive, lead_researcher, staff —
  //   are scoped to records they own. This is what makes per-AE revenue
  //   accounting reliable: AEs cannot accidentally touch another AE's deals.
  OWNERSHIP_BYPASS:            "ownership:bypass",
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

  // admin: same capability set as super_admin for day-to-day operations,
  // EXCEPT for capabilities reserved to super_admin and a small set of
  // lead-sourcing flows that should not be touched at the operations level.
  //
  // The only super_admin-exclusive actions are:
  //   1. Promote a user TO super_admin
  //   2. Demote / modify an existing super_admin
  // Both are enforced in the users action layer, not via capabilities,
  // so the rest of the system works without requiring super_admin approval.
  //
  // BUYER_MANUAL_INTAKE is intentionally excluded here: the manual buyer
  // intake screens (`/admin/leads/new`, `/admin/leads/import`) are the
  // legacy flow that bypasses AI matching. Only lead_researcher uses them
  // day-to-day; super_admin keeps it for system-owner overrides.
  admin: ALL_CAPS.filter((c) => c !== CAPS.BUYER_MANUAL_INTAKE),

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

    // AI matching inbox — the AE's main daily queue.
    CAPS.MATCH_INBOX_VIEW,

    // Clients
    CAPS.CLIENT_VIEW,
    CAPS.CLIENT_WRITE,
    CAPS.CLIENT_COMPLIANCE_WRITE,

    // Read-only signals.
    // NOTE: COUNTRY_RISK_READ is intentionally NOT granted. The country
    // risk register is owned by super_admin / admin to keep classifications
    // consistent across the org; AE consumes risk only via buyer/client
    // surfaces (read-through DB, no cap check needed).
    CAPS.FINANCE_READ,

    // Analytics — scoped to assigned clients only.
    CAPS.ANALYTICS_VIEW_OWN,
    // SLA — scoped, read-only.
    CAPS.SLA_VIEW_OWN,
  ],

  lead_researcher: [
    // Lead Researcher is a narrow, buyer-only role: source buyers, enrich
    // them, and analyse buyer/country signals. They do NOT see clients,
    // pipeline (deals), the AE matching inbox, SLA, or pipeline analytics.
    // Buyers — WRITE allowed, but PII VIEW is denied → UI must mask.
    CAPS.BUYER_VIEW,
    CAPS.BUYER_WRITE,
    // Manual buyer intake screens — used when ImportYeti / AI sourcing
    // is not an option. AE is intentionally NOT granted this capability.
    CAPS.BUYER_MANUAL_INTAKE,
    // Read-only access to the AI matching inbox so LR can monitor
    // whether the buyers they sourced are getting matched / claimed
    // by AEs. UI MUST hide claim/accept controls for LR — see the
    // AE Inbox component which gates write actions on `BUYER_WRITE`
    // + role check.
    CAPS.MATCH_INBOX_VIEW,
    // NOTE: COUNTRY_RISK_READ is intentionally NOT granted. The country
    // risk register is curated by super_admin / admin only to avoid
    // inconsistent classifications. LR can still SEE per-country risk on
    // buyer pages (read-through DB), they just can't open the register.
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
    // SLA — finance edits targets / penalties, sees full breakdown.
    CAPS.SLA_VIEW_ALL,
    CAPS.SLA_TARGET_WRITE,

    // Bookkeeping needs cross-AE visibility — finance must see every deal
    // to issue invoices and reconcile commission.
    CAPS.OWNERSHIP_BYPASS,
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
    // COUNTRY_RISK_READ removed — register is admin-only.
    CAPS.FINANCE_READ,
    CAPS.ANALYTICS_VIEW_OWN,
    CAPS.SLA_VIEW_OWN,
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
