export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agency_organizations: {
        Row: {
          created_at: string;
          created_by: string;
          organization_id: string;
          request_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          organization_id: string;
          request_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          organization_id?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_organizations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_staff_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          agency_id: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          recipient_email: string;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          agency_id: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          recipient_email: string;
          state?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          agency_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          recipient_email?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_staff_invitations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agency_organizations";
            referencedColumns: ["organization_id"];
          },
        ];
      };
      analytics_days: {
        Row: {
          brand_id: string;
          captured_at: string;
          id: string;
          metadata: NonNullable<Json>;
          metrics: Json | null;
          observed_date: string;
          provider: string;
          provider_timezone: string;
          run_id: string;
          source_id: string;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          captured_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          metrics?: Json | null;
          observed_date: string;
          provider: string;
          provider_timezone: string;
          run_id: string;
          source_id: string;
          state: string;
        };
        Update: {
          brand_id?: string;
          captured_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          metrics?: Json | null;
          observed_date?: string;
          provider?: string;
          provider_timezone?: string;
          run_id?: string;
          source_id?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_days_brand_id_run_id_fkey";
            columns: ["brand_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "collection_runs";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "analytics_days_brand_id_source_id_fkey";
            columns: ["brand_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "brand_sources";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      audit_checks: {
        Row: {
          brand_id: string;
          checked_at: string;
          error_code: string | null;
          evidence: NonNullable<Json>;
          id: string;
          run_id: string;
          status: number | null;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          checked_at?: string;
          error_code?: string | null;
          evidence?: NonNullable<Json>;
          id?: string;
          run_id: string;
          status?: number | null;
          url: string;
        };
        Update: {
          brand_id?: string;
          checked_at?: string;
          error_code?: string | null;
          evidence?: NonNullable<Json>;
          id?: string;
          run_id?: string;
          status?: number | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_checks_brand_id_run_id_fkey";
            columns: ["brand_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      audit_findings: {
        Row: {
          brand_id: string;
          code: string;
          evidence: string;
          explanation: string;
          first_seen_at: string;
          id: string;
          last_checked_at: string;
          last_run_id: string;
          severity: string;
          state: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          code: string;
          evidence: string;
          explanation: string;
          first_seen_at?: string;
          id?: string;
          last_checked_at?: string;
          last_run_id: string;
          severity: string;
          state?: string;
          url: string;
        };
        Update: {
          brand_id?: string;
          code?: string;
          evidence?: string;
          explanation?: string;
          first_seen_at?: string;
          id?: string;
          last_checked_at?: string;
          last_run_id?: string;
          severity?: string;
          state?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_findings_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_findings_brand_id_last_run_id_fkey";
            columns: ["brand_id", "last_run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      baseline_reviews: {
        Row: {
          acknowledged_at: string;
          actor_id: string;
          brand_id: string;
          data_gaps: string;
          id: string;
          monitoring_scope: string;
          request_id: string;
          responsibilities: string;
          snapshot: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string;
          actor_id: string;
          brand_id: string;
          data_gaps: string;
          id?: string;
          monitoring_scope: string;
          request_id: string;
          responsibilities: string;
          snapshot: NonNullable<Json>;
        };
        Update: {
          acknowledged_at?: string;
          actor_id?: string;
          brand_id?: string;
          data_gaps?: string;
          id?: string;
          monitoring_scope?: string;
          request_id?: string;
          responsibilities?: string;
          snapshot?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "baseline_reviews_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_access_grants: {
        Row: {
          accepted_by: string;
          access_level: string;
          active: boolean;
          agency_organization_id: string;
          brand_id: string;
          capabilities: string[];
          created_at: string;
          id: string;
          invitation_id: string;
          permission_version: number;
          revoked_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_by: string;
          access_level: string;
          active?: boolean;
          agency_organization_id: string;
          brand_id: string;
          capabilities?: string[];
          created_at?: string;
          id?: string;
          invitation_id: string;
          permission_version?: number;
          revoked_at?: string | null;
        };
        Update: {
          accepted_by?: string;
          access_level?: string;
          active?: boolean;
          agency_organization_id?: string;
          brand_id?: string;
          capabilities?: string[];
          created_at?: string;
          id?: string;
          invitation_id?: string;
          permission_version?: number;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_access_grants_agency_organization_id_fkey";
            columns: ["agency_organization_id"];
            isOneToOne: false;
            referencedRelation: "agency_organizations";
            referencedColumns: ["organization_id"];
          },
          {
            foreignKeyName: "brand_access_grants_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_access_grants_brand_id_invitation_id_fkey";
            columns: ["brand_id", "invitation_id"];
            isOneToOne: false;
            referencedRelation: "brand_invitations";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      brand_claim_requests: {
        Row: {
          accepted_brand_id: string | null;
          agency_id: string;
          brand_name: string;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          created_by: string;
          decision_reason: string | null;
          expires_at: string;
          id: string;
          owner_email: string;
          reporting_timezone: string;
          request_id: string;
          state: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_brand_id?: string | null;
          agency_id: string;
          brand_name: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by: string;
          decision_reason?: string | null;
          expires_at?: string;
          id?: string;
          owner_email: string;
          reporting_timezone: string;
          request_id: string;
          state?: string;
          website?: string | null;
        };
        Update: {
          accepted_brand_id?: string | null;
          agency_id?: string;
          brand_name?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          created_by?: string;
          decision_reason?: string | null;
          expires_at?: string;
          id?: string;
          owner_email?: string;
          reporting_timezone?: string;
          request_id?: string;
          state?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_claim_requests_accepted_brand_id_fkey";
            columns: ["accepted_brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_claim_requests_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agency_organizations";
            referencedColumns: ["organization_id"];
          },
        ];
      };
      brand_fact_revisions: {
        Row: {
          actor_id: string;
          brand_id: string;
          fact_id: string;
          recorded_at: string;
          snapshot: NonNullable<Json>;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          brand_id: string;
          fact_id: string;
          recorded_at?: string;
          snapshot: NonNullable<Json>;
          version: number;
        };
        Update: {
          actor_id?: string;
          brand_id?: string;
          fact_id?: string;
          recorded_at?: string;
          snapshot?: NonNullable<Json>;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "brand_fact_revisions_brand_id_fact_id_fkey";
            columns: ["brand_id", "fact_id"];
            isOneToOne: false;
            referencedRelation: "brand_facts";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      brand_facts: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          brand_id: string;
          category: string;
          created_at: string;
          created_by: string;
          id: string;
          request_id: string;
          responsible_owner: string;
          review_on: string;
          source_description: string;
          source_url: string | null;
          state: string;
          statement: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          brand_id: string;
          category: string;
          created_at?: string;
          created_by: string;
          id?: string;
          request_id: string;
          responsible_owner: string;
          review_on: string;
          source_description: string;
          source_url?: string | null;
          state?: string;
          statement: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          brand_id?: string;
          category?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          request_id?: string;
          responsible_owner?: string;
          review_on?: string;
          source_description?: string;
          source_url?: string | null;
          state?: string;
          statement?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "brand_facts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_invitations: {
        Row: {
          accepted_agency_id: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          access_level: string;
          brand_id: string;
          brand_name: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          recipient_email: string;
          request_id: string;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_agency_id?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          access_level: string;
          brand_id: string;
          brand_name: string;
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          recipient_email: string;
          request_id: string;
          state?: string;
        };
        Update: {
          accepted_agency_id?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          access_level?: string;
          brand_id?: string;
          brand_name?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          recipient_email?: string;
          request_id?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_invitations_accepted_agency_id_fkey";
            columns: ["accepted_agency_id"];
            isOneToOne: false;
            referencedRelation: "agency_organizations";
            referencedColumns: ["organization_id"];
          },
          {
            foreignKeyName: "brand_invitations_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_memberships: {
        Row: {
          active: boolean;
          brand_id: string;
          capabilities: string[];
          organization_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          brand_id: string;
          capabilities?: string[];
          organization_id: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          brand_id?: string;
          capabilities?: string[];
          organization_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_memberships_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_memberships_organization_id_user_id_fkey";
            columns: ["organization_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "organization_memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
      brand_sources: {
        Row: {
          account_label: string;
          account_reference: string;
          brand_id: string;
          created_at: string;
          created_by: string;
          error_code: string | null;
          granted_scopes: string[];
          id: string;
          last_success_at: string | null;
          provider: string;
          provider_metadata: NonNullable<Json>;
          provider_timezone: string | null;
          reconciliation_requested_at: string | null;
          state: string;
          updated_at: string;
          updated_by: string;
          verified_account: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          account_label: string;
          account_reference: string;
          brand_id: string;
          created_at?: string;
          created_by: string;
          error_code?: string | null;
          granted_scopes?: string[];
          id?: string;
          last_success_at?: string | null;
          provider: string;
          provider_metadata?: NonNullable<Json>;
          provider_timezone?: string | null;
          reconciliation_requested_at?: string | null;
          state?: string;
          updated_at?: string;
          updated_by: string;
          verified_account?: string | null;
          version?: number;
        };
        Update: {
          account_label?: string;
          account_reference?: string;
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          error_code?: string | null;
          granted_scopes?: string[];
          id?: string;
          last_success_at?: string | null;
          provider?: string;
          provider_metadata?: NonNullable<Json>;
          provider_timezone?: string | null;
          reconciliation_requested_at?: string | null;
          state?: string;
          updated_at?: string;
          updated_by?: string;
          verified_account?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "brand_sources_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          owner_organization_id: string;
          reporting_timezone: string;
          request_id: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          owner_organization_id: string;
          reporting_timezone: string;
          request_id: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          owner_organization_id?: string;
          reporting_timezone?: string;
          request_id?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brand_workspaces_owner_organization_id_fkey";
            columns: ["owner_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogue_records: {
        Row: {
          brand_id: string;
          external_id: string;
          id: string;
          kind: string;
          observed_at: string;
          payload: NonNullable<Json>;
          removed_at: string | null;
          seen_run_id: string;
          source_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          external_id: string;
          id?: string;
          kind: string;
          observed_at?: string;
          payload: NonNullable<Json>;
          removed_at?: string | null;
          seen_run_id: string;
          source_id: string;
          title: string;
        };
        Update: {
          brand_id?: string;
          external_id?: string;
          id?: string;
          kind?: string;
          observed_at?: string;
          payload?: NonNullable<Json>;
          removed_at?: string | null;
          seen_run_id?: string;
          source_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalogue_records_brand_id_seen_run_id_fkey";
            columns: ["brand_id", "seen_run_id"];
            isOneToOne: false;
            referencedRelation: "collection_runs";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "catalogue_records_brand_id_source_id_fkey";
            columns: ["brand_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "brand_sources";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      client_reports: {
        Row: {
          annotation: string;
          brand_id: string;
          created_at: string;
          created_by: string;
          id: string;
          range_end: string;
          range_start: string;
          request_id: string;
          snapshot: NonNullable<Json>;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          annotation: string;
          brand_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          range_end: string;
          range_start: string;
          request_id: string;
          snapshot: NonNullable<Json>;
          title: string;
        };
        Update: {
          annotation?: string;
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          range_end?: string;
          range_start?: string;
          request_id?: string;
          snapshot?: NonNullable<Json>;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_reports_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_allowances: {
        Row: {
          brand_id: string;
          monthly_observation_limit: number;
          monthly_run_limit: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          monthly_observation_limit?: number;
          monthly_run_limit?: number;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          monthly_observation_limit?: number;
          monthly_run_limit?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_allowances_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: true;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_runs: {
        Row: {
          actor_id: string;
          brand_id: string;
          completed_at: string | null;
          created_at: string;
          cursor: string | null;
          error_code: string | null;
          id: string;
          kind: string;
          pages: number;
          phase: string;
          range_end: string | null;
          range_start: string | null;
          records: number;
          request_id: string;
          source_id: string;
          source_version: number;
          state: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          brand_id: string;
          completed_at?: string | null;
          created_at?: string;
          cursor?: string | null;
          error_code?: string | null;
          id?: string;
          kind: string;
          pages?: number;
          phase?: string;
          range_end?: string | null;
          range_start?: string | null;
          records?: number;
          request_id: string;
          source_id: string;
          source_version: number;
          state?: string;
        };
        Update: {
          actor_id?: string;
          brand_id?: string;
          completed_at?: string | null;
          created_at?: string;
          cursor?: string | null;
          error_code?: string | null;
          id?: string;
          kind?: string;
          pages?: number;
          phase?: string;
          range_end?: string | null;
          range_start?: string | null;
          records?: number;
          request_id?: string;
          source_id?: string;
          source_version?: number;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_runs_brand_id_source_id_fkey";
            columns: ["brand_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "brand_sources";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      observation_cohorts: {
        Row: {
          brand_id: string;
          created_at: string;
          created_by: string;
          id: string;
          interval_days: number;
          language: string;
          market: string;
          model: string;
          name: string;
          next_run_at: string | null;
          permission_attested: boolean;
          questions: string[];
          samples: number;
          scheduled: boolean;
          subjects: string[];
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          interval_days?: number;
          language: string;
          market: string;
          model: string;
          name: string;
          next_run_at?: string | null;
          permission_attested: boolean;
          questions: string[];
          samples: number;
          scheduled?: boolean;
          subjects: string[];
        };
        Update: {
          brand_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          interval_days?: number;
          language?: string;
          market?: string;
          model?: string;
          name?: string;
          next_run_at?: string | null;
          permission_attested?: boolean;
          questions?: string[];
          samples?: number;
          scheduled?: boolean;
          subjects?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "observation_cohorts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      observation_samples: {
        Row: {
          actual_model: string | null;
          answer: string | null;
          brand_id: string;
          error_code: string | null;
          id: string;
          mentions: NonNullable<Json>;
          observed_at: string;
          ordinal: number;
          provider_response_id: string | null;
          question: string;
          run_id: string;
          state: string;
          usage: Json | null;
        };
        ComputedFields: never;
        Insert: {
          actual_model?: string | null;
          answer?: string | null;
          brand_id: string;
          error_code?: string | null;
          id?: string;
          mentions?: NonNullable<Json>;
          observed_at?: string;
          ordinal: number;
          provider_response_id?: string | null;
          question: string;
          run_id: string;
          state: string;
          usage?: Json | null;
        };
        Update: {
          actual_model?: string | null;
          answer?: string | null;
          brand_id?: string;
          error_code?: string | null;
          id?: string;
          mentions?: NonNullable<Json>;
          observed_at?: string;
          ordinal?: number;
          provider_response_id?: string | null;
          question?: string;
          run_id?: string;
          state?: string;
          usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "observation_samples_brand_id_run_id_fkey";
            columns: ["brand_id", "run_id"];
            isOneToOne: false;
            referencedRelation: "research_runs";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      opportunities: {
        Row: {
          affected_reference: string;
          assignee_id: string | null;
          brand_id: string;
          business_relevance: string;
          confidence_reason: string;
          created_at: string;
          created_by: string;
          decision_reason: string | null;
          effort: string;
          evidence_needs_review: boolean;
          fact_id: string;
          fact_version: number;
          id: string;
          priority: number;
          problem: string;
          proposed_action: string;
          request_id: string;
          snooze_until: string | null;
          state: string;
          title: string;
          updated_at: string;
          updated_by: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          affected_reference: string;
          assignee_id?: string | null;
          brand_id: string;
          business_relevance: string;
          confidence_reason: string;
          created_at?: string;
          created_by: string;
          decision_reason?: string | null;
          effort: string;
          evidence_needs_review?: boolean;
          fact_id: string;
          fact_version: number;
          id?: string;
          priority?: number;
          problem: string;
          proposed_action: string;
          request_id: string;
          snooze_until?: string | null;
          state?: string;
          title: string;
          updated_at?: string;
          updated_by: string;
          version?: number;
        };
        Update: {
          affected_reference?: string;
          assignee_id?: string | null;
          brand_id?: string;
          business_relevance?: string;
          confidence_reason?: string;
          created_at?: string;
          created_by?: string;
          decision_reason?: string | null;
          effort?: string;
          evidence_needs_review?: boolean;
          fact_id?: string;
          fact_version?: number;
          id?: string;
          priority?: number;
          problem?: string;
          proposed_action?: string;
          request_id?: string;
          snooze_until?: string | null;
          state?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_brand_id_fact_id_fkey";
            columns: ["brand_id", "fact_id"];
            isOneToOne: false;
            referencedRelation: "brand_facts";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "opportunities_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_fact_id_fact_version_fkey";
            columns: ["fact_id", "fact_version"];
            isOneToOne: false;
            referencedRelation: "brand_fact_revisions";
            referencedColumns: ["fact_id", "version"];
          },
        ];
      };
      opportunity_events: {
        Row: {
          actor_id: string;
          brand_id: string;
          created_at: string;
          details: NonNullable<Json>;
          event_type: string;
          id: string;
          opportunity_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          brand_id: string;
          created_at?: string;
          details: NonNullable<Json>;
          event_type: string;
          id?: string;
          opportunity_id: string;
        };
        Update: {
          actor_id?: string;
          brand_id?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          event_type?: string;
          id?: string;
          opportunity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_events_brand_id_opportunity_id_fkey";
            columns: ["brand_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["brand_id", "id"];
          },
        ];
      };
      organization_memberships: {
        Row: {
          active: boolean;
          organization_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          organization_id: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          organization_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      research_runs: {
        Row: {
          actor_id: string;
          brand_id: string;
          cohort_id: string | null;
          completed_at: string | null;
          completed_samples: number;
          created_at: string;
          error_code: string | null;
          expected_samples: number;
          fresh_until: string | null;
          id: string;
          kind: string;
          request_id: string;
          snapshot: NonNullable<Json>;
          state: string;
          target_url: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          brand_id: string;
          cohort_id?: string | null;
          completed_at?: string | null;
          completed_samples?: number;
          created_at?: string;
          error_code?: string | null;
          expected_samples?: number;
          fresh_until?: string | null;
          id?: string;
          kind: string;
          request_id: string;
          snapshot?: NonNullable<Json>;
          state?: string;
          target_url?: string | null;
        };
        Update: {
          actor_id?: string;
          brand_id?: string;
          cohort_id?: string | null;
          completed_at?: string | null;
          completed_samples?: number;
          created_at?: string;
          error_code?: string | null;
          expected_samples?: number;
          fresh_until?: string | null;
          id?: string;
          kind?: string;
          request_id?: string;
          snapshot?: NonNullable<Json>;
          state?: string;
          target_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "research_runs_brand_id_cohort_id_fkey";
            columns: ["brand_id", "cohort_id"];
            isOneToOne: false;
            referencedRelation: "observation_cohorts";
            referencedColumns: ["brand_id", "id"];
          },
          {
            foreignKeyName: "research_runs_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      support_sessions: {
        Row: {
          access_level: string;
          brand_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          operator_id: string;
          owner_id: string;
          purpose: string;
          revoked_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          access_level: string;
          brand_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          operator_id: string;
          owner_id: string;
          purpose: string;
          revoked_at?: string | null;
        };
        Update: {
          access_level?: string;
          brand_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          operator_id?: string;
          owner_id?: string;
          purpose?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_sessions_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brand_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_agency_staff: { Args: { invitation: string }; Returns: string };
      accept_brand_claim_request: {
        Args: {
          claim_request: string;
          owner_attested: boolean;
          owner_organization_name: string;
        };
        Returns: string;
      };
      accept_brand_invitation: {
        Args: { agency: string; invitation: string };
        Returns: string;
      };
      acknowledge_baseline: {
        Args: {
          confirmed: boolean;
          creation_request_id: string;
          gaps_text: string;
          responsibility_text: string;
          scope_text: string;
          target_brand: string;
        };
        Returns: string;
      };
      cancel_agency_staff_invitation: {
        Args: { agency: string; invitation: string };
        Returns: undefined;
      };
      cancel_brand_invitation: {
        Args: { invitation: string; target_brand: string };
        Returns: undefined;
      };
      cancel_research: {
        Args: { run: string; target_brand: string };
        Returns: undefined;
      };
      close_brand_claim_request: {
        Args: { claim_request: string; decision: string; reason: string };
        Returns: undefined;
      };
      comment_opportunity: {
        Args: {
          comment_body: string;
          opportunity: string;
          target_brand: string;
        };
        Returns: undefined;
      };
      create_agency: {
        Args: { agency_name: string; creation_request_id: string };
        Returns: string;
      };
      create_brand_claim_request: {
        Args: {
          agency: string;
          authorized: boolean;
          creation_request_id: string;
          proposed_name: string;
          recipient_email: string;
          timezone_name: string;
          website_url: string;
        };
        Returns: string;
      };
      create_brand_fact: {
        Args: {
          creation_request_id: string;
          fact_category: string;
          fact_owner: string;
          fact_statement: string;
          review_date: string;
          source_link: string;
          source_note: string;
          target_brand: string;
        };
        Returns: string;
      };
      create_brand_invitation: {
        Args: {
          email_address: string;
          invitation_request_id: string;
          requested_access: string;
          target_brand: string;
        };
        Returns: string;
      };
      create_client_report: {
        Args: {
          creation_request_id: string;
          end_date: string;
          report_annotation: string;
          report_title: string;
          start_date: string;
          target_brand: string;
        };
        Returns: string;
      };
      create_observation_cohort: {
        Args: {
          cohort_name: string;
          competitors: string[];
          model_id: string;
          permission_confirmed: boolean;
          question_list: string[];
          requested_language: string;
          requested_market: string;
          sample_count: number;
          target_brand: string;
        };
        Returns: string;
      };
      create_opportunity: {
        Args: {
          action_description: string;
          affected: string;
          confidence_description: string;
          creation_request_id: string;
          effort_size: string;
          evidence_fact: string;
          evidence_version: number;
          opportunity_title: string;
          problem_description: string;
          relevance_description: string;
          target_brand: string;
        };
        Returns: string;
      };
      create_owner_workspace: {
        Args: {
          brand_name: string;
          onboarding_request_id: string;
          organization_name: string;
          owner_attested: boolean;
          timezone_name: string;
          website_url: string;
        };
        Returns: string;
      };
      current_brand_capability: {
        Args: { capability: string; target_brand: string };
        Returns: boolean;
      };
      grant_support_session: {
        Args: {
          duration_hours: number;
          email_address: string;
          purpose_text: string;
          requested_access: string;
          target_brand: string;
        };
        Returns: string;
      };
      invite_agency_staff: {
        Args: { agency: string; email_address: string };
        Returns: string;
      };
      list_agency_staff: {
        Args: { agency: string };
        Returns: {
          active: boolean;
          email: string;
          user_id: string;
        }[];
      };
      list_opportunity_assignees: {
        Args: { target_brand: string };
        Returns: {
          email: string;
          user_id: string;
        }[];
      };
      refresh_opportunity_evidence: {
        Args: {
          expected_version: number;
          opportunity: string;
          target_brand: string;
        };
        Returns: undefined;
      };
      register_brand_source: {
        Args: {
          source_label: string;
          source_provider: string;
          source_reference: string;
          target_brand: string;
        };
        Returns: string;
      };
      request_research: {
        Args: {
          cohort: string;
          creation_request_id: string;
          research_kind: string;
          target_brand: string;
        };
        Returns: string;
      };
      request_source_sync: {
        Args: { source: string; sync_request_id: string; target_brand: string };
        Returns: string;
      };
      review_brand_fact: {
        Args: {
          decision: string;
          expected_version: number;
          fact_id: string;
          target_brand: string;
        };
        Returns: undefined;
      };
      revoke_agency_access: {
        Args: { access_grant: string; target_brand: string };
        Returns: undefined;
      };
      revoke_agency_staff: {
        Args: { agency: string; staff_user: string };
        Returns: undefined;
      };
      revoke_support_session: {
        Args: { support_session: string; target_brand: string };
        Returns: undefined;
      };
      save_brand_fact: {
        Args: {
          creation_request_id: string;
          expected_version: number;
          fact_category: string;
          fact_id: string;
          fact_owner: string;
          fact_statement: string;
          review_date: string;
          source_link: string;
          source_note: string;
          target_brand: string;
        };
        Returns: string;
      };
      schedule_observation_cohort: {
        Args: {
          cohort: string;
          enabled: boolean;
          frequency_days: number;
          target_brand: string;
        };
        Returns: undefined;
      };
      set_agency_capabilities: {
        Args: {
          access_grant: string;
          expected_version: number;
          requested_capabilities: string[];
          target_brand: string;
        };
        Returns: undefined;
      };
      set_brand_source_state: {
        Args: {
          expected_version: number;
          next_state: string;
          source_id: string;
          target_brand: string;
        };
        Returns: undefined;
      };
      set_collection_allowance: {
        Args: { run_limit: number; target_brand: string };
        Returns: undefined;
      };
      set_observation_allowance: {
        Args: { request_limit: number; target_brand: string };
        Returns: undefined;
      };
      update_brand_settings: {
        Args: {
          brand_name: string;
          target_brand: string;
          timezone_name: string;
          website_url: string;
        };
        Returns: undefined;
      };
      update_opportunity: {
        Args: {
          assignee: string;
          expected_version: number;
          next_priority: number;
          next_state: string;
          opportunity: string;
          reason: string;
          snooze_to: string;
          target_brand: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
