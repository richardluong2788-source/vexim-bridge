export type Role =
  | "admin"
  | "staff"
  | "client"
  | "super_admin"
  | "lead_researcher"
  | "account_executive"
  | "finance"

export type Stage =
  | "new"
  | "contacted"
  | "sample_requested"
  | "sample_sent"
  | "negotiation"
  | "price_agreed"
  | "production"
  | "shipped"
  | "won"
  | "lost"

/** Stages that require the client to have a valid FDA registration. */
export const COMPLIANCE_REQUIRED_STAGES: Stage[] = [
  "sample_requested",
  "sample_sent",
  "negotiation",
  "price_agreed",
  "production",
  "shipped",
  "won",
]

export type EmailType = "introduction" | "follow_up" | "quotation" | "custom"
export type EmailDraftStatus =
  | "pending_approval"
  | "approved"
  | "sent"
  | "rejected"
  | "failed"
export type PaymentStatus = "pending" | "partial" | "paid" | "cancelled"

export type PreferredLanguage = "vi" | "en"

// Re-export for convenience so consumers can import both from one module.
export type RiskLevel = "low" | "medium" | "high"

/** Compliance document kinds (SOP §0.2). Must match the DB CHECK constraint. */
export type ComplianceDocKind =
  | "fda_certificate"
  | "coa"
  | "price_floor"
  | "factory_video"
  | "factory_photo"
  | "other"

export type NotificationCategory =
  | "action_required"
  | "status_update"
  | "deal_closed"
  | "new_assignment"
  | "system"

export type NotificationEmailStatus = "sent" | "failed" | "skipped"

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          role: Role
          company_name: string | null
          industry: string | null
          industries: string[]
          phone: string | null
          fda_registration_number: string | null
          fda_registered_at: string | null
          fda_expires_at: string | null
          fda_renewal_notified_at: string | null
          avatar_url: string | null
          preferred_language: PreferredLanguage
          // Sprint 3 — staff member responsible for this client.
          // Populated by Admin / Super-Admin via /admin/clients UI.
          // Drives ANALYTICS_VIEW_OWN scope for AE / Lead Researcher.
          account_manager_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: Role
          company_name?: string | null
          industry?: string | null
          industries?: string[]
          phone?: string | null
          fda_registration_number?: string | null
          fda_registered_at?: string | null
          fda_expires_at?: string | null
          fda_renewal_notified_at?: string | null
          avatar_url?: string | null
          preferred_language?: PreferredLanguage
          account_manager_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: Role
          company_name?: string | null
          industry?: string | null
          industries?: string[]
          phone?: string | null
          fda_registration_number?: string | null
          fda_registered_at?: string | null
          fda_expires_at?: string | null
          fda_renewal_notified_at?: string | null
          avatar_url?: string | null
          preferred_language?: PreferredLanguage
          account_manager_id?: string | null
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          company_name: string
          contact_person: string | null
          contact_email: string | null
          contact_phone: string | null
          linkedin_url: string | null
          industry: string | null
          website: string | null
          region: string | null
          country: string | null
          notes: string | null
          source: string | null
          enriched_data: Record<string, unknown> | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_name: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          linkedin_url?: string | null
          industry?: string | null
          website?: string | null
          region?: string | null
          country?: string | null
          notes?: string | null
          source?: string | null
          enriched_data?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          contact_person?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          linkedin_url?: string | null
          industry?: string | null
          website?: string | null
          region?: string | null
          country?: string | null
          notes?: string | null
          source?: string | null
          enriched_data?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
        }
      }
      opportunities: {
        Row: {
          id: string
          client_id: string
          lead_id: string
          stage: Stage
          potential_value: number | null
          notes: string | null
          buyer_code: string | null
          products_interested: string | null
          quantity_required: string | null
          target_price_usd: number | null
          price_unit: string | null
          incoterms: string | null
          payment_terms: string | null
          destination_port: string | null
          target_close_date: string | null
          next_step: string | null
          client_action_required: string | null
          client_action_due_date: string | null
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          lead_id: string
          stage?: Stage
          potential_value?: number | null
          notes?: string | null
          buyer_code?: string | null
          products_interested?: string | null
          quantity_required?: string | null
          target_price_usd?: number | null
          price_unit?: string | null
          incoterms?: string | null
          payment_terms?: string | null
          destination_port?: string | null
          target_close_date?: string | null
          next_step?: string | null
          client_action_required?: string | null
          client_action_due_date?: string | null
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          lead_id?: string
          stage?: Stage
          potential_value?: number | null
          notes?: string | null
          buyer_code?: string | null
          products_interested?: string | null
          quantity_required?: string | null
          target_price_usd?: number | null
          price_unit?: string | null
          incoterms?: string | null
          payment_terms?: string | null
          destination_port?: string | null
          target_close_date?: string | null
          next_step?: string | null
          client_action_required?: string | null
          client_action_due_date?: string | null
          last_updated?: string
          created_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          opportunity_id: string | null
          action_type: string
          description: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id?: string | null
          action_type: string
          description?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string | null
          action_type?: string
          description?: string | null
          performed_by?: string | null
          created_at?: string
        }
      }
      deals: {
        Row: {
          id: string
          opportunity_id: string
          po_number: string | null
          invoice_value: number | null
          commission_rate: number
          commission_amount: number
          payment_status: PaymentStatus
          invoice_pdf_url: string | null
          notes: string | null
          // Sprint A — Closing & Compliance (SOP Phase 3)
          po_doc_url: string | null
          swift_doc_url: string | null
          transaction_reference: string | null
          swift_verified: boolean
          swift_verified_at: string | null
          swift_verified_by: string | null
          // Sprint A+R05 — Segregation of Duties on Swift verification.
          // swift_uploaded_by MUST NOT equal swift_verified_by (DB CHECK).
          swift_uploaded_by: string | null
          swift_uploaded_at: string | null
          bl_doc_url: string | null
          risk_level: RiskLevel | null
          // Sprint B — Financials (GENERATED)
          cost_price_supplier: number | null
          suggested_selling_price: number | null
          quantity_units: number | null
          unit_label: string | null
          profit_margin_usd: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          opportunity_id: string
          po_number?: string | null
          invoice_value?: number | null
          commission_rate?: number
          payment_status?: PaymentStatus
          invoice_pdf_url?: string | null
          notes?: string | null
          po_doc_url?: string | null
          swift_doc_url?: string | null
          transaction_reference?: string | null
          swift_verified?: boolean
          swift_verified_at?: string | null
          swift_verified_by?: string | null
          swift_uploaded_by?: string | null
          swift_uploaded_at?: string | null
          bl_doc_url?: string | null
          risk_level?: RiskLevel | null
          cost_price_supplier?: number | null
          suggested_selling_price?: number | null
          quantity_units?: number | null
          unit_label?: string | null
          // profit_margin_usd is a GENERATED column; never insert.
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string
          po_number?: string | null
          invoice_value?: number | null
          commission_rate?: number
          payment_status?: PaymentStatus
          invoice_pdf_url?: string | null
          notes?: string | null
          po_doc_url?: string | null
          swift_doc_url?: string | null
          transaction_reference?: string | null
          swift_verified?: boolean
          swift_verified_at?: string | null
          swift_verified_by?: string | null
          swift_uploaded_by?: string | null
          swift_uploaded_at?: string | null
          bl_doc_url?: string | null
          risk_level?: RiskLevel | null
          cost_price_supplier?: number | null
          suggested_selling_price?: number | null
          quantity_units?: number | null
          unit_label?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      compliance_docs: {
        Row: {
          id: string
          owner_id: string
          kind: ComplianceDocKind
          title: string | null
          url: string
          mime_type: string | null
          size_bytes: number | null
          issued_at: string | null
          expires_at: string | null
          notes: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          kind: ComplianceDocKind
          title?: string | null
          url: string
          mime_type?: string | null
          size_bytes?: number | null
          issued_at?: string | null
          expires_at?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          kind?: ComplianceDocKind
          title?: string | null
          url?: string
          mime_type?: string | null
          size_bytes?: number | null
          issued_at?: string | null
          expires_at?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tokenized_share_links: {
        Row: {
          token: string
          // Nullable since migration 022 — bundle links (multi-doc)
          // leave this NULL and list docs in `tokenized_share_link_docs`.
          doc_id: string | null
          owner_id: string
          created_by: string | null
          expires_at: string
          revoked_at: string | null
          view_count: number
          last_viewed_at: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          token?: string
          doc_id?: string | null
          owner_id: string
          created_by?: string | null
          expires_at: string
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          token?: string
          doc_id?: string | null
          owner_id?: string
          created_by?: string | null
          expires_at?: string
          revoked_at?: string | null
          view_count?: number
          last_viewed_at?: string | null
          note?: string | null
          created_at?: string
        }
      }
      tokenized_share_link_docs: {
        Row: {
          token: string
          doc_id: string
          position: number
          created_at: string
        }
        Insert: {
          token: string
          doc_id: string
          position?: number
          created_at?: string
        }
        Update: {
          token?: string
          doc_id?: string
          position?: number
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          category: NotificationCategory
          title: string
          body: string | null
          link_path: string | null
          opportunity_id: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category: NotificationCategory
          title: string
          body?: string | null
          link_path?: string | null
          opportunity_id?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category?: NotificationCategory
          title?: string
          body?: string | null
          link_path?: string | null
          opportunity_id?: string | null
          read_at?: string | null
          created_at?: string
        }
      }
      notification_preferences: {
        Row: {
          user_id: string
          email_enabled: boolean
          email_action_required: boolean
          email_status_update: boolean
          email_deal_closed: boolean
          email_new_assignment: boolean
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_enabled?: boolean
          email_action_required?: boolean
          email_status_update?: boolean
          email_deal_closed?: boolean
          email_new_assignment?: boolean
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email_enabled?: boolean
          email_action_required?: boolean
          email_status_update?: boolean
          email_deal_closed?: boolean
          email_new_assignment?: boolean
          unsubscribe_token?: string
          updated_at?: string
        }
      }
      notification_email_log: {
        Row: {
          id: string
          user_id: string
          dedup_key: string
          provider_id: string | null
          status: NotificationEmailStatus
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dedup_key: string
          provider_id?: string | null
          status?: NotificationEmailStatus
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dedup_key?: string
          provider_id?: string | null
          status?: NotificationEmailStatus
          error?: string | null
          created_at?: string
        }
      }
      email_drafts: {
        Row: {
          id: string
          opportunity_id: string | null
          email_type: EmailType
          vi_prompt: string
          generated_subject_en: string | null
          generated_content_en: string | null
          translated_content_vi: string | null
          status: EmailDraftStatus
          recipient_email: string | null
          created_by: string | null
          approved_by: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id?: string | null
          email_type?: EmailType
          vi_prompt: string
          generated_subject_en?: string | null
          generated_content_en?: string | null
          translated_content_vi?: string | null
          status?: EmailDraftStatus
          recipient_email?: string | null
          created_by?: string | null
          approved_by?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string | null
          email_type?: EmailType
          vi_prompt?: string
          generated_subject_en?: string | null
          generated_content_en?: string | null
          translated_content_vi?: string | null
          status?: EmailDraftStatus
          recipient_email?: string | null
          created_by?: string | null
          approved_by?: string | null
          sent_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Convenience types for joined queries
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Lead = Database["public"]["Tables"]["leads"]["Row"]
export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"]
export type Activity = Database["public"]["Tables"]["activities"]["Row"]
export type Deal = Database["public"]["Tables"]["deals"]["Row"]
export type EmailDraft = Database["public"]["Tables"]["email_drafts"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"]
export type NotificationEmailLog = Database["public"]["Tables"]["notification_email_log"]["Row"]

export type OpportunityWithLead = Opportunity & {
  leads: Lead
}

export type OpportunityWithClient = Opportunity & {
  profiles: Profile
  leads: Lead
}

export type ComplianceDoc =
  Database["public"]["Tables"]["compliance_docs"]["Row"]
export type TokenizedShareLink =
  Database["public"]["Tables"]["tokenized_share_links"]["Row"]

/**
 * A tokenized share link joined with its bundle docs.
 *
 * - Single-doc links: `doc_id` is set, `doc_ids` is `[doc_id]`.
 * - Bundle links:    `doc_id` is null, `doc_ids` lists every doc
 *                    referenced via `tokenized_share_link_docs`.
 */
export type TokenizedShareLinkWithDocs = TokenizedShareLink & {
  doc_ids: string[]
}

/** Sprint D — AI-classified buyer reply intents. Must match DB CHECK. */
export type BuyerReplyIntent =
  | "price_request"
  | "sample_request"
  | "objection"
  | "closing_signal"
  | "general"

export type BuyerReply = {
  id: string
  opportunity_id: string
  raw_content: string
  raw_language: string
  translated_vi: string | null
  ai_intent: BuyerReplyIntent | null
  ai_summary: string | null
  ai_confidence: number | null
  ai_suggested_next_step: string | null
  ai_model: string | null
  received_at: string
  created_by: string | null
  created_at: string
}

// ============================================================
// Finance / Cash-flow (migration 016)
// ============================================================

export type BillingPlanStatus = "active" | "paused" | "terminated"

export type BillingPlan = {
  id: string
  client_id: string
  plan_name: string
  setup_fee_usd: number | null
  monthly_retainer_usd: number | null
  success_fee_percent: number | null
  retainer_credit_percent: number
  contract_start_date: string | null
  contract_end_date: string | null
  billing_anchor_day: number
  status: BillingPlanStatus
  fx_rate_vnd_per_usd: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type InvoiceKind = "setup_fee" | "retainer" | "success_fee" | "manual"

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled"
  | "void"

export type IssuerSnapshot = {
  company_name: string | null
  company_address: string | null
  company_tax_id: string | null
  company_email: string | null
  company_phone: string | null
}

export type BankSnapshot = {
  bank_name: string | null
  bank_account_no: string | null
  bank_account_name: string | null
  bank_bin: string | null
  bank_swift_code: string | null
}

export type Invoice = {
  id: string
  invoice_number: string
  public_token: string
  kind: InvoiceKind
  client_id: string
  billing_plan_id: string | null
  deal_id: string | null
  amount_usd: number
  credit_applied_usd: number
  net_amount_usd: number
  fx_rate_vnd_per_usd: number
  status: InvoiceStatus
  issue_date: string
  due_date: string
  period_start: string | null
  period_end: string | null
  paid_at: string | null
  paid_amount_usd: number | null
  payment_reference: string | null
  memo: string | null
  pdf_url: string | null
  email_sent_at: string | null
  issuer_snapshot: IssuerSnapshot | null
  bank_snapshot: BankSnapshot | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RetainerCreditKind = "earned" | "applied" | "expired" | "adjustment"

export type RetainerCredit = {
  id: string
  client_id: string
  kind: RetainerCreditKind
  amount_usd: number
  source_invoice_id: string | null
  applied_to_invoice_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type ExpenseCategory =
  | "salary"
  | "tools"
  | "marketing"
  | "office"
  | "legal"
  | "travel"
  | "other"

export type OperatingExpense = {
  id: string
  expense_date: string
  category: ExpenseCategory
  vendor: string | null
  description: string | null
  amount_usd: number
  fx_rate_vnd_per_usd: number | null
  is_recurring: boolean
  recurring_frequency: "monthly" | "quarterly" | "yearly" | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type FinanceSettings = {
  id: number
  default_fx_rate_vnd_per_usd: number
  invoice_prefix: string
  default_payment_terms_days: number
  company_name: string | null
  company_address: string | null
  company_tax_id: string | null
  company_email: string | null
  company_phone: string | null
  bank_name: string | null
  bank_account_no: string | null
  bank_account_name: string | null
  bank_bin: string | null
  bank_swift_code: string | null
  updated_by: string | null
  updated_at: string
}
