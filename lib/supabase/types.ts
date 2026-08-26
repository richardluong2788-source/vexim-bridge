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

export type EmailType =
  | "introduction"
  | "follow_up"
  | "quotation"
  | "sample_offer"
  | "negotiation"
  | "custom"
  | "requirement_inquiry"
  | "shortlist_delivery"
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
          /** Client's (supplier's) own country — free text, mirrors leads.country. Added in 047; used by calculateCountryMatch(). */
          country: string | null
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
          // AI Match — KYC verification (Trust Score input)
          is_verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          role?: Role
          company_name?: string | null
          industry?: string | null
          industries?: string[]
          country?: string | null
          phone?: string | null
          fda_registration_number?: string | null
          fda_registered_at?: string | null
          fda_expires_at?: string | null
          fda_renewal_notified_at?: string | null
          avatar_url?: string | null
          preferred_language?: PreferredLanguage
          account_manager_id?: string | null
          created_at?: string
          is_verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          role?: Role
          company_name?: string | null
          industry?: string | null
          industries?: string[]
          country?: string | null
          phone?: string | null
          fda_registration_number?: string | null
          fda_registered_at?: string | null
          fda_expires_at?: string | null
          fda_renewal_notified_at?: string | null
          avatar_url?: string | null
          preferred_language?: PreferredLanguage
          account_manager_id?: string | null
          created_at?: string
          is_verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
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
          // Section 1: THONG TIN DINH DANH
          import_address: string | null
          source_ref: string | null
          contact_title: string | null
          // Section 2: DU LIEU DINH LUONG
          total_shipments: number | null
          last_shipment_date: string | null
          avg_teu_per_month: number | null
          top_peak_months: string | null
          top_low_months: string | null
          // Section 3: MA HS & SAN PHAM
          hs_code: string | null
          main_product: string | null
          secondary_hs_codes: string | null
          // Section 4: CHUOI CUNG UNG
          top_suppliers: { name: string; country: string | null }[] | null
          main_import_countries: string | null
          competitors: string | null
          // Section 5: LOGISTICS
          origin_ports: string | null
          destination_ports: string | null
          container_types: string | null
          // Section 6: GHI CHU CHO AI
          bol_description: string | null
          purchase_history: string | null
          priority_rating: number | null
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
          // Section 1
          import_address?: string | null
          source_ref?: string | null
          contact_title?: string | null
          // Section 2
          total_shipments?: number | null
          last_shipment_date?: string | null
          avg_teu_per_month?: number | null
          top_peak_months?: string | null
          top_low_months?: string | null
          // Section 3
          hs_code?: string | null
          main_product?: string | null
          secondary_hs_codes?: string | null
          // Section 4
          top_suppliers?: { name: string; country: string | null }[] | null
          main_import_countries?: string | null
          competitors?: string | null
          // Section 5
          origin_ports?: string | null
          destination_ports?: string | null
          container_types?: string | null
          // Section 6
          bol_description?: string | null
          purchase_history?: string | null
          priority_rating?: number | null
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
          // Section 1
          import_address?: string | null
          source_ref?: string | null
          contact_title?: string | null
          // Section 2
          total_shipments?: number | null
          last_shipment_date?: string | null
          avg_teu_per_month?: number | null
          top_peak_months?: string | null
          top_low_months?: string | null
          // Section 3
          hs_code?: string | null
          main_product?: string | null
          secondary_hs_codes?: string | null
          // Section 4
          top_suppliers?: { name: string; country: string | null }[] | null
          main_import_countries?: string | null
          competitors?: string | null
          // Section 5
          origin_ports?: string | null
          destination_ports?: string | null
          container_types?: string | null
          // Section 6
          bol_description?: string | null
          purchase_history?: string | null
          priority_rating?: number | null
        }
      }
      buyer_contacts: {
        Row: {
          id: string
          lead_id: string
          full_name: string
          title: string | null
          email: string | null
          phone: string | null
          department: string | null
          market_region: string | null
          is_primary: boolean
          is_decision_maker: boolean
          status: string
          referred_by_contact_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          full_name: string
          title?: string | null
          email?: string | null
          phone?: string | null
          department?: string | null
          market_region?: string | null
          is_primary?: boolean
          is_decision_maker?: boolean
          status?: string
          referred_by_contact_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          full_name?: string
          title?: string | null
          email?: string | null
          phone?: string | null
          department?: string | null
          market_region?: string | null
          is_primary?: boolean
          is_decision_maker?: boolean
          status?: string
          referred_by_contact_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_contacts_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_contacts_referred_by_contact_id_fkey"
            columns: ["referred_by_contact_id"]
            referencedRelation: "buyer_contacts"
            referencedColumns: ["id"]
          }
        ]
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
          expiry_notified_at: string | null
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
          expiry_notified_at?: string | null
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
          expiry_notified_at?: string | null
          notes?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      compliance_doc_history: {
        Row: {
          id: string
          doc_id: string
          owner_id: string
          action: "created" | "updated" | "deleted" | "expired" | "renewed"
          changed_by: string | null
          changes: Record<string, boolean> | null
          old_values: Record<string, unknown> | null
          new_values: Record<string, unknown> | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doc_id: string
          owner_id: string
          action: "created" | "updated" | "deleted" | "expired" | "renewed"
          changed_by?: string | null
          changes?: Record<string, boolean> | null
          old_values?: Record<string, unknown> | null
          new_values?: Record<string, unknown> | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doc_id?: string
          owner_id?: string
          action?: "created" | "updated" | "deleted" | "expired" | "renewed"
          changed_by?: string | null
          changes?: Record<string, boolean> | null
          old_values?: Record<string, unknown> | null
          new_values?: Record<string, unknown> | null
          notes?: string | null
          created_at?: string
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
          telegram_enabled: boolean
          telegram_chat_id: string | null
          telegram_username: string | null
          telegram_action_required: boolean
          telegram_status_update: boolean
          telegram_deal_closed: boolean
          telegram_new_assignment: boolean
          telegram_link_token: string
          telegram_link_token_expires_at: string | null
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
          telegram_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_action_required?: boolean
          telegram_status_update?: boolean
          telegram_deal_closed?: boolean
          telegram_new_assignment?: boolean
          telegram_link_token?: string
          telegram_link_token_expires_at?: string | null
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
          telegram_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_username?: string | null
          telegram_action_required?: boolean
          telegram_status_update?: boolean
          telegram_deal_closed?: boolean
          telegram_new_assignment?: boolean
          telegram_link_token?: string
          telegram_link_token_expires_at?: string | null
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
      notification_telegram_log: {
        Row: {
          id: string
          user_id: string
          dedup_key: string
          message_id: string | null
          status: NotificationEmailStatus
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dedup_key: string
          message_id?: string | null
          status?: NotificationEmailStatus
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dedup_key?: string
          message_id?: string | null
          status?: NotificationEmailStatus
          error?: string | null
          created_at?: string
        }
      }
      client_profiles: {
        Row: {
          id: string
          client_id: string
          slug: string
          display_name: string | null
          tagline: string | null
          cover_image_url: string | null
          logo_url: string | null
          factory_image_urls: string[]
          video_url: string | null
          video_thumbnail_url: string | null
          usp_points: Record<string, unknown>[]
          production_capacity: string | null
          moq: string | null
          lead_time_days: string | null
          featured_certifications: string[]
          featured_products: string[]
          enable_request_quote: boolean
          enable_download_pdf: boolean
          pdf_capability_url: string | null
          is_published: boolean
          published_at: string | null
          view_count: number
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          slug: string
          display_name?: string | null
          tagline?: string | null
          cover_image_url?: string | null
          logo_url?: string | null
          factory_image_urls?: string[]
          video_url?: string | null
          video_thumbnail_url?: string | null
          usp_points?: Record<string, unknown>[]
          production_capacity?: string | null
          moq?: string | null
          lead_time_days?: string | null
          featured_certifications?: string[]
          featured_products?: string[]
          enable_request_quote?: boolean
          enable_download_pdf?: boolean
          pdf_capability_url?: string | null
          is_published?: boolean
          published_at?: string | null
          view_count?: number
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          slug?: string
          display_name?: string | null
          tagline?: string | null
          cover_image_url?: string | null
          logo_url?: string | null
          factory_image_urls?: string[]
          video_url?: string | null
          video_thumbnail_url?: string | null
          usp_points?: Record<string, unknown>[]
          production_capacity?: string | null
          moq?: string | null
          lead_time_days?: string | null
          featured_certifications?: string[]
          featured_products?: string[]
          enable_request_quote?: boolean
          enable_download_pdf?: boolean
          pdf_capability_url?: string | null
          is_published?: boolean
          published_at?: string | null
          view_count?: number
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      client_intake_submissions: {
        Row: {
          id: string
          token: string
          ae_id: string
          status: "pending" | "submitted" | "approved" | "rejected"
          expires_at: string
          contact_name: string | null
          email: string | null
          phone: string | null
          company_name: string | null
          industries: string[]
          country: string | null
          address: string | null
          website: string | null
          tax_code: string | null
          tagline: string | null
          company_description: string | null
          main_products: string | null
          production_capacity: string | null
          moq: string | null
          lead_time_days: string | null
          usp_points: Record<string, unknown>[]
          logo_url: string | null
          cover_image_url: string | null
          factory_image_urls: string[]
          video_url: string | null
          certifications: string[]
          certifications_other: string | null
          quality_systems: string[]
          quality_systems_other: string | null
          oem_odm: string[]
          company_scale: string | null
          export_since_year: number | null
          export_markets: string[]
          export_markets_other: string | null
          traceability: string[]
          fda_status: string | null
          fda_number: string | null
          fda_expires_at: string | null
          staff_engineers_count: number | null
          staff_workers_count: number | null
          work_hours_start: string | null
          work_hours_end: string | null
          work_days_per_week: number | null
          food_safety_training_regular: boolean | null
          equipment_calibration_regular: boolean | null
          water_source: string[]
          water_source_other: string | null
          water_testing: boolean | null
          near_pollution_source: boolean | null
          pollution_source_note: string | null
          audit_readiness: string[]
          audit_owner: string | null
          incoterms: string[]
          payment_policy: string | null
          oem_policy: string | null
          odm_policy: string | null
          has_export_dept: boolean | null
          has_english_staff: boolean | null
          pricing_decision_maker: string | null
          commitments: string[]
          project_priority: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          rejection_reason: string | null
          created_client_id: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          token: string
          ae_id: string
          status?: "pending" | "submitted" | "approved" | "rejected"
          expires_at?: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          industries?: string[]
          country?: string | null
          address?: string | null
          website?: string | null
          tax_code?: string | null
          tagline?: string | null
          company_description?: string | null
          main_products?: string | null
          production_capacity?: string | null
          moq?: string | null
          lead_time_days?: string | null
          usp_points?: Record<string, unknown>[]
          logo_url?: string | null
          cover_image_url?: string | null
          factory_image_urls?: string[]
          video_url?: string | null
          certifications?: string[]
          certifications_other?: string | null
          quality_systems?: string[]
          quality_systems_other?: string | null
          oem_odm?: string[]
          company_scale?: string | null
          export_since_year?: number | null
          export_markets?: string[]
          export_markets_other?: string | null
          traceability?: string[]
          fda_status?: string | null
          fda_number?: string | null
          fda_expires_at?: string | null
          staff_engineers_count?: number | null
          staff_workers_count?: number | null
          work_hours_start?: string | null
          work_hours_end?: string | null
          work_days_per_week?: number | null
          food_safety_training_regular?: boolean | null
          equipment_calibration_regular?: boolean | null
          water_source?: string[]
          water_source_other?: string | null
          water_testing?: boolean | null
          near_pollution_source?: boolean | null
          pollution_source_note?: string | null
          audit_readiness?: string[]
          audit_owner?: string | null
          incoterms?: string[]
          payment_policy?: string | null
          oem_policy?: string | null
          odm_policy?: string | null
          has_export_dept?: boolean | null
          has_english_staff?: boolean | null
          pricing_decision_maker?: string | null
          commitments?: string[]
          project_priority?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          rejection_reason?: string | null
          created_client_id?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          token?: string
          ae_id?: string
          status?: "pending" | "submitted" | "approved" | "rejected"
          expires_at?: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          industries?: string[]
          country?: string | null
          address?: string | null
          website?: string | null
          tax_code?: string | null
          tagline?: string | null
          company_description?: string | null
          main_products?: string | null
          production_capacity?: string | null
          moq?: string | null
          lead_time_days?: string | null
          usp_points?: Record<string, unknown>[]
          logo_url?: string | null
          cover_image_url?: string | null
          factory_image_urls?: string[]
          video_url?: string | null
          certifications?: string[]
          certifications_other?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          rejection_reason?: string | null
          created_client_id?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_intake_submissions_ae_id_fkey"
            columns: ["ae_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intake_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intake_submissions_created_client_id_fkey"
            columns: ["created_client_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      client_factory_assessments: {
        Row: {
          id: string
          client_id: string
          quality_systems: string[]
          quality_systems_other: string | null
          oem_odm: string[]
          company_scale: string | null
          export_since_year: number | null
          export_markets: string[]
          export_markets_other: string | null
          traceability: string[]
          audit_readiness: string[]
          audit_owner: string | null
          incoterms: string[]
          payment_policy: string | null
          oem_policy: string | null
          odm_policy: string | null
          has_export_dept: boolean | null
          has_english_staff: boolean | null
          pricing_decision_maker: string | null
          commitments: string[]
          project_priority: string | null
          staff_engineers_count: number | null
          staff_workers_count: number | null
          work_hours_start: string | null
          work_hours_end: string | null
          work_days_per_week: number | null
          food_safety_training_regular: boolean | null
          equipment_calibration_regular: boolean | null
          water_source: string[]
          water_source_other: string | null
          water_testing: boolean | null
          near_pollution_source: boolean | null
          pollution_source_note: string | null
          score_total: number | null
          score_grade: string | null
          score_breakdown: Record<string, unknown>
          scored_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          quality_systems?: string[]
          quality_systems_other?: string | null
          oem_odm?: string[]
          company_scale?: string | null
          export_since_year?: number | null
          export_markets?: string[]
          export_markets_other?: string | null
          traceability?: string[]
          audit_readiness?: string[]
          audit_owner?: string | null
          incoterms?: string[]
          payment_policy?: string | null
          oem_policy?: string | null
          odm_policy?: string | null
          has_export_dept?: boolean | null
          has_english_staff?: boolean | null
          pricing_decision_maker?: string | null
          commitments?: string[]
          project_priority?: string | null
          staff_engineers_count?: number | null
          staff_workers_count?: number | null
          work_hours_start?: string | null
          work_hours_end?: string | null
          work_days_per_week?: number | null
          food_safety_training_regular?: boolean | null
          equipment_calibration_regular?: boolean | null
          water_source?: string[]
          water_source_other?: string | null
          water_testing?: boolean | null
          near_pollution_source?: boolean | null
          pollution_source_note?: string | null
          production_capacity_monthly?: string | null
          lead_time_days?: string | null
          score_total?: number | null
          score_grade?: string | null
          score_breakdown?: Record<string, unknown>
          scored_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          quality_systems?: string[]
          quality_systems_other?: string | null
          oem_odm?: string[]
          company_scale?: string | null
          export_since_year?: number | null
          export_markets?: string[]
          export_markets_other?: string | null
          traceability?: string[]
          audit_readiness?: string[]
          audit_owner?: string | null
          incoterms?: string[]
          payment_policy?: string | null
          oem_policy?: string | null
          odm_policy?: string | null
          has_export_dept?: boolean | null
          has_english_staff?: boolean | null
          pricing_decision_maker?: string | null
          commitments?: string[]
          project_priority?: string | null
          staff_engineers_count?: number | null
          staff_workers_count?: number | null
          work_hours_start?: string | null
          work_hours_end?: string | null
          work_days_per_week?: number | null
          food_safety_training_regular?: boolean | null
          equipment_calibration_regular?: boolean | null
          water_source?: string[]
          water_source_other?: string | null
          water_testing?: boolean | null
          near_pollution_source?: boolean | null
          pollution_source_note?: string | null
          production_capacity_monthly?: string | null
          lead_time_days?: string | null
          score_total?: number | null
          score_grade?: string | null
          score_breakdown?: Record<string, unknown>
          scored_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_factory_assessments_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      email_drafts: {
        Row: {
          id: string
          opportunity_id: string | null
          lead_id: string | null
          engagement_id: string | null
          email_type: EmailType
          ai_prompt: string
          generated_subject: string | null
          generated_content_en: string | null
          translated_content_vi: string | null
          status: EmailDraftStatus
          recipient_email: string | null
          cc_emails: string[] | null
          created_by: string | null
          approved_by: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          opportunity_id?: string | null
          lead_id?: string | null
          engagement_id?: string | null
          email_type?: EmailType
          ai_prompt: string
          generated_subject?: string | null
          generated_content_en?: string | null
          translated_content_vi?: string | null
          status?: EmailDraftStatus
          recipient_email?: string | null
          cc_emails?: string[] | null
          created_by?: string | null
          approved_by?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          opportunity_id?: string | null
          lead_id?: string | null
          engagement_id?: string | null
          email_type?: EmailType
          ai_prompt?: string
          generated_subject?: string | null
          generated_content_en?: string | null
          translated_content_vi?: string | null
          status?: EmailDraftStatus
          recipient_email?: string | null
          cc_emails?: string[] | null
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
export type BuyerContact = Database["public"]["Tables"]["buyer_contacts"]["Row"]
export type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"]
export type Activity = Database["public"]["Tables"]["activities"]["Row"]
export type Deal = Database["public"]["Tables"]["deals"]["Row"]
export type EmailDraft = Database["public"]["Tables"]["email_drafts"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type NotificationPreferences = Database["public"]["Tables"]["notification_preferences"]["Row"]
export type NotificationEmailLog = Database["public"]["Tables"]["notification_email_log"]["Row"]
export type NotificationTelegramLog = Database["public"]["Tables"]["notification_telegram_log"]["Row"]

export type ClientFactoryAssessment =
  Database["public"]["Tables"]["client_factory_assessments"]["Row"]

export type OpportunityWithLead = Opportunity & {
  leads: Lead
}

export type OpportunityWithClient = Opportunity & {
  profiles: Profile & { client_profiles?: Pick<ClientProfile, "display_name"> | null }
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
  /** Null = unread. Set when an admin first reads this reply. */
  read_at: string | null
  /** Sender address of the inbound email (from Resend webhook). Null for
   *  legacy replies logged manually by pasting text — no sender captured. */
  from_email: string | null
  subject: string | null
  message_id: string | null
  in_reply_to: string | null
  /** How this reply was matched to an opportunity: thread header vs sender email. */
  match_source: "in_reply_to" | "sender_email" | null
  match_confidence: number | null
  /** buyer_contacts.id that matches from_email, if this sender is already
   *  in the buyer's contact directory. Used to auto-lock the reply
   *  composer's recipient so AE cannot accidentally reply to the wrong
   *  contact when a buyer company has multiple contacts. */
  matched_contact_id: string | null
  /** True when from_email is NOT in buyer_contacts for this lead yet
   *  (e.g. buyer introduced a colleague) — AE should add them as a contact. */
  is_unrecognized_sender: boolean
}

// ============================================================
// Commercial Intelligence (Sprint - CI validation)
// ============================================================

export type CommercialIntelligence = {
  id: string
  opportunity_id: string
  main_hs_code: string | null
  import_history_summary: string | null
  main_competitors: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

// ============================================================
// Bank Directory & L/C Verification (Sprint - LC Bank Safety)
// ============================================================

export type BankDirectoryEntry = {
  bic: string
  bank_name: string
  country_code: string
  country_name: string | null
  tier: 1 | 2 | 3 | 4
  is_sanctioned: boolean
  has_correspondent_vn: boolean
  notes: string | null
  source: string | null
  updated_at: string
}

export type LCVerification = {
  id: string
  opportunity_id: string
  // Issuing bank (Layer 1 + 2 + 3)
  bank_bic: string | null
  bank_name_snapshot: string | null
  bank_country_snapshot: string | null
  detected_tier: 1 | 2 | 3 | 4 | null
  detected_sanctioned: boolean | null
  recommendation: string | null
  // Checklist 6 (Layer 4)
  received_via_swift: boolean
  bic_matches: boolean
  amount_matches_po: boolean
  description_matches_po: boolean
  shipment_date_reasonable: boolean
  no_soft_clauses: boolean
  // Document
  lc_document_url: string | null
  // Status
  verification_status: "pending" | "verified" | "rejected"
  rejection_reason: string | null
  // Audit
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
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

// ============================================================
// AI Matching (Sprint - AE Matching)
// ============================================================

export type MatchAssignmentSource = "auto" | "manual" | "llm_augmented"

export type AEMatchScore = {
  id: string
  lead_id: string
  account_manager_id: string
  total_score: number
  product_match_score: number
  industry_match_score: number
  fda_compliance_score: number
  workload_score: number
  win_rate_score: number
  country_match_score: number
  factors: Record<string, unknown>
  assignment_source: MatchAssignmentSource | null
  assigned_at: string | null
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export type MatchInboxStatus = "pending" | "accepted" | "rejected" | "expired"
export type MatchInboxPriority = "high" | "medium" | "low"

export type AEMatchInbox = {
  id: string
  lead_id: string
  account_manager_id: string
  match_score_id: string | null
  status: MatchInboxStatus
  priority: MatchInboxPriority
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  expires_at: string
}

export type MatchingConfig = {
  id: string
  config_key: string
  config_value: Record<string, unknown>
  description: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** Scoring weights configuration */
export type ScoringWeights = {
  product_match: number
  industry_match: number
  workload: number
  win_rate: number
  fda_compliance: number
  country_match: number
}

/** Threshold configuration */
export type MatchingThresholds = {
  auto_assign: number
  inbox_min: number
  inbox_max: number
}

/** AE Workload summary from view */
export type AEWorkloadSummary = {
  account_manager_id: string
  full_name: string | null
  email: string | null
  in_progress_count: number
  new_count: number
  contacted_count: number
  active_count: number
}

/** AE Win Rate by industry from view */
export type AEWinRateByIndustry = {
  account_manager_id: string
  industry: string | null
  wins: number
  losses: number
  total_closed: number
  win_rate: number
}

/** AE Client Products summary from view */
export type AEClientProducts = {
  account_manager_id: string
  client_id: string
  client_name: string | null
  client_industry: string | null
  client_industries: string[]
  /** Client's registered country — drives calculateCountryMatch() in the AE matching scorer. */
  client_country: string | null
  fda_expires_at: string | null
  fda_valid: boolean
  product_categories: string[]
  product_subcategories: string[]
  /** Real HS codes from client_products.hs_code — drives calculateHSCodeMatch() instead of regex-mining product_categories. */
  product_hs_codes: string[]
}

/** Buyer pool view row */
export type BuyerPoolRow = Lead & {
  has_opportunity: boolean
  assigned_count: number
  top_match_score: number | null
}

/** Match result with AE details */
export type MatchResultWithAE = AEMatchScore & {
  profiles: Profile
}

/** Inbox item with full details */
export type InboxItemWithDetails = AEMatchInbox & {
  leads: Lead
  ae_match_scores: AEMatchScore | null
}

// ============================================================
// Client Profiles (Public Profile for US Buyers)
// ============================================================

/** USP point displayed on client profile */
export type USPPoint = {
  title: string
  icon: string // Lucide icon name: "clock", "award", "globe", "factory", "shield", "leaf"
}

/** Client product (from client_products table) */
export type ClientProduct = {
  id: string
  client_id: string
  product_name: string
  product_code: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  hs_code: string | null
  unit_of_measure: string
  min_unit_price: number | null
  max_unit_price: number | null
  currency: string
  monthly_capacity_units: number | null
  status: "active" | "inactive" | "suspended"
  image_urls: string[]
  compliance_badges: string[]
  created_by: string | null
  created_at: string
  updated_at: string

  // Origin & specifications
  country_of_origin: string | null
  key_specifications: string | null
  usp: string | null

  // Order terms
  moq_value: number | null
  moq_unit: string | null
  lead_time: string | null
  sample_available: boolean
  sample_notes: string | null

  // Pricing & trade terms
  price_unit: string | null
  incoterm: string | null
  incoterm_place: string | null
  payment_terms: string | null

  // Packing & storage
  packing: string | null
  package_size: string | null
  shelf_life: string | null
  storage_conditions: string | null

  // Private label
  private_label_available: boolean
  private_label_notes: string | null
}

/** Client profile for public display to buyers */
export type ClientProfile = {
  id: string
  client_id: string

  // Branding
  slug: string
  cover_image_url: string | null
  logo_url: string | null
  factory_image_urls: string[]

  // Display info
  display_name: string | null
  tagline: string | null
  description: string | null

  // Video
  video_url: string | null
  video_thumbnail_url: string | null

  // USP Points
  usp_points: USPPoint[]

  // Production stats
  production_capacity: string | null
  moq: string | null
  lead_time_days: string | null

  // Featured items (IDs from other tables)
  featured_certifications: string[]
  featured_products: string[]

  // CTA options
  enable_request_quote: boolean
  enable_download_pdf: boolean
  pdf_capability_url: string | null

  // Visibility
  is_published: boolean
  published_at: string | null

  // View tracking
  view_count: number

  // Audit
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** Client profile with joined relations for display */
export type ClientProfileWithRelations = ClientProfile & {
  profiles: Profile
  certifications: ComplianceDoc[]
  products: ClientProduct[]
}

/** Input for creating a new client profile */
export type CreateClientProfileInput = {
  client_id: string
  slug: string
  display_name?: string
  tagline?: string
  description?: string
  cover_image_url?: string
  logo_url?: string
  factory_image_urls?: string[]
  video_url?: string
  video_thumbnail_url?: string
  usp_points?: USPPoint[]
  production_capacity?: string
  moq?: string
  lead_time_days?: string
  featured_certifications?: string[]
  featured_products?: string[]
  enable_request_quote?: boolean
  enable_download_pdf?: boolean
  pdf_capability_url?: string
}

/** Input for updating a client profile */
export type UpdateClientProfileInput = Partial<Omit<CreateClientProfileInput, "client_id">>

/** Quote request from buyer via profile page */
export type ProfileQuoteRequest = {
  profile_id: string
  company_name: string
  contact_name: string
  email: string
  phone?: string
  country?: string
  products_interested: string[]
  quantity_volume?: string
  notes?: string
  }
