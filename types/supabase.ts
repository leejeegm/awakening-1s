export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      awakenings: {
        Row: {
          id: string;
          created_at: string;
          nickname: string;
          note: string;
          duration_type: string;
          is_public: boolean;
          moderation_state: "ok" | "deleted";
          moderation_reason: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          purge_hold: boolean;
          resonance_kind: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          note: string;
          duration_type?: string;
          resonance_kind?: string | null;
          is_public?: boolean;
          moderation_state?: "ok" | "deleted";
          moderation_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          purge_hold?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          nickname?: string;
          note?: string;
          duration_type?: string;
          resonance_kind?: string | null;
          is_public?: boolean;
          moderation_state?: "ok" | "deleted";
          moderation_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          purge_hold?: boolean;
        };
        Relationships: [];
      };
      participant_keys: {
        Row: {
          nickname: string;
          password_hash: string;
          password_hint: string | null;
        };
        Insert: {
          nickname: string;
          password_hash: string;
          password_hint?: string | null;
        };
        Update: {
          nickname?: string;
          password_hash?: string;
          password_hint?: string | null;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          awakening_id: string;
          reaction_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          awakening_id: string;
          reaction_type: "gam" | "eung";
          created_at?: string;
        };
        Update: {
          id?: string;
          awakening_id?: string;
          reaction_type?: "gam" | "eung";
          created_at?: string;
        };
        Relationships: [];
      };
      admin_actions: {
        Row: {
          id: string;
          created_at: string;
          action: string;
          awakening_id: string;
          old_note: string | null;
          new_note: string | null;
          reason: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          action: string;
          awakening_id: string;
          old_note?: string | null;
          new_note?: string | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          awakening_id?: string;
          old_note?: string | null;
          new_note?: string | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      admin_entitlement_actions: {
        Row: {
          id: string;
          created_at: string;
          nickname: string;
          feature_key: string;
          enabled: boolean;
          expires_at: string | null;
          source: string | null;
          enabled_by: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          feature_key: string;
          enabled: boolean;
          expires_at?: string | null;
          source?: string | null;
          enabled_by?: string | null;
        };
        Update: {
          enabled?: boolean;
          expires_at?: string | null;
          source?: string | null;
          enabled_by?: string | null;
        };
        Relationships: [];
      };
      participant_plans: {
        Row: {
          nickname: string;
          plan_type: string;
          valid_until: string;
          created_at: string;
        };
        Insert: {
          nickname: string;
          plan_type: "cho" | "bun" | "si";
          valid_until: string;
          created_at?: string;
        };
        Update: {
          plan_type?: "cho" | "bun" | "si";
          valid_until?: string;
        };
        Relationships: [];
      };
      participant_profiles: {
        Row: {
          nickname: string;
          gender: string | null;
          age_group: string | null;
          updated_at: string;
        };
        Insert: {
          nickname: string;
          gender?: "male" | "female" | "defer" | null;
          age_group?: string | null;
          updated_at?: string;
        };
        Update: {
          gender?: "male" | "female" | "defer" | null;
          age_group?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      participant_entitlements: {
        Row: {
          nickname: string;
          feature_key: string;
          enabled: boolean;
          enabled_by: string | null;
          source: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nickname: string;
          feature_key: string;
          enabled?: boolean;
          enabled_by?: string | null;
          source?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          enabled_by?: string | null;
          source?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      premium_report_products: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          default_pages: number;
          sections_json: Json;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          default_pages?: number;
          sections_json?: Json;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string | null;
          default_pages?: number;
          sections_json?: Json;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      premium_report_requests: {
        Row: {
          id: string;
          nickname: string;
          product_id: string;
          status: "requested" | "paid_pending" | "approved" | "in_progress" | "ready" | "rejected" | "expired";
          payment_status: "unpaid" | "pending_manual_check" | "confirmed" | "failed" | "refunded";
          admin_note: string | null;
          approved_by: string | null;
          approved_at: string | null;
          downloadable: boolean;
          downloadable_at: string | null;
          expires_at: string | null;
          requested_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nickname: string;
          product_id: string;
          status?: "requested" | "paid_pending" | "approved" | "in_progress" | "ready" | "rejected" | "expired";
          payment_status?: "unpaid" | "pending_manual_check" | "confirmed" | "failed" | "refunded";
          admin_note?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          downloadable?: boolean;
          downloadable_at?: string | null;
          expires_at?: string | null;
          requested_at?: string;
          updated_at?: string;
        };
        Update: {
          nickname?: string;
          product_id?: string;
          status?: "requested" | "paid_pending" | "approved" | "in_progress" | "ready" | "rejected" | "expired";
          payment_status?: "unpaid" | "pending_manual_check" | "confirmed" | "failed" | "refunded";
          admin_note?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          downloadable?: boolean;
          downloadable_at?: string | null;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      premium_report_source_snapshots: {
        Row: {
          id: string;
          request_id: string;
          profile_json: Json;
          trend_json: Json;
          ai_history_json: Json;
          record_window_from: string;
          record_window_to: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          profile_json?: Json;
          trend_json?: Json;
          ai_history_json?: Json;
          record_window_from: string;
          record_window_to: string;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          profile_json?: Json;
          trend_json?: Json;
          ai_history_json?: Json;
          record_window_from?: string;
          record_window_to?: string;
        };
        Relationships: [];
      };
      premium_report_documents: {
        Row: {
          id: string;
          request_id: string;
          version: number;
          title: string;
          summary_text: string | null;
          sections_json: Json;
          page_count: number;
          pdf_status: "draft" | "generating" | "ready" | "failed";
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          version?: number;
          title: string;
          summary_text?: string | null;
          sections_json?: Json;
          page_count?: number;
          pdf_status?: "draft" | "generating" | "ready" | "failed";
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          request_id?: string;
          version?: number;
          title?: string;
          summary_text?: string | null;
          sections_json?: Json;
          page_count?: number;
          pdf_status?: "draft" | "generating" | "ready" | "failed";
          created_by?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      premium_report_assets: {
        Row: {
          id: string;
          request_id: string;
          asset_type: "chart_image" | "attachment_pdf" | "attachment_image" | "final_pdf" | "analysis_note";
          storage_bucket: string | null;
          storage_path: string | null;
          mime_type: string | null;
          meta_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          asset_type: "chart_image" | "attachment_pdf" | "attachment_image" | "final_pdf" | "analysis_note";
          storage_bucket?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          meta_json?: Json;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          asset_type?: "chart_image" | "attachment_pdf" | "attachment_image" | "final_pdf" | "analysis_note";
          storage_bucket?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          meta_json?: Json;
        };
        Relationships: [];
      };
      premium_report_actions: {
        Row: {
          id: string;
          request_id: string;
          action: string;
          actor: string | null;
          meta_json: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          action: string;
          actor?: string | null;
          meta_json?: Json;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          action?: string;
          actor?: string | null;
          meta_json?: Json;
        };
        Relationships: [];
      };
      premium_report_eligibility_snapshots: {
        Row: {
          nickname: string;
          qualifies: boolean;
          consecutive_weeks: number;
          qualifies_from_week: string | null;
          evaluated_at: string;
          weekly_day_counts_json: Json;
          meta_json: Json;
        };
        Insert: {
          nickname: string;
          qualifies?: boolean;
          consecutive_weeks?: number;
          qualifies_from_week?: string | null;
          evaluated_at?: string;
          weekly_day_counts_json?: Json;
          meta_json?: Json;
        };
        Update: {
          qualifies?: boolean;
          consecutive_weeks?: number;
          qualifies_from_week?: string | null;
          evaluated_at?: string;
          weekly_day_counts_json?: Json;
          meta_json?: Json;
        };
        Relationships: [];
      };
      image_generation_usage: {
        Row: {
          id: string;
          created_at: string;
          nickname: string;
          feature_key: string;
          mode: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          feature_key: string;
          mode?: string;
        };
        Update: {
          nickname?: string;
          feature_key?: string;
          mode?: string;
        };
        Relationships: [];
      };
      image_generation_locks: {
        Row: {
          nickname: string;
          locked_until: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          nickname: string;
          locked_until: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          locked_until?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      image_generation_jobs: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          nickname: string;
          feature_key: string;
          status: "pending" | "running" | "done" | "failed";
          prompt: string;
          negative_prompt: string | null;
          prompt_hash: string;
          width: number;
          height: number;
          steps: number;
          error_message: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          result_width: number | null;
          result_height: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          nickname: string;
          feature_key: string;
          status?: "pending" | "running" | "done" | "failed";
          prompt: string;
          negative_prompt?: string | null;
          prompt_hash: string;
          width: number;
          height: number;
          steps: number;
          error_message?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          result_width?: number | null;
          result_height?: number | null;
        };
        Update: {
          status?: "pending" | "running" | "done" | "failed";
          error_message?: string | null;
          storage_bucket?: string | null;
          storage_path?: string | null;
          result_width?: number | null;
          result_height?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      image_generation_assets: {
        Row: {
          id: string;
          created_at: string;
          nickname: string;
          feature_key: string;
          mode: string;
          prompt: string;
          negative_prompt: string | null;
          prompt_hash: string;
          width: number | null;
          height: number | null;
          steps: number | null;
          storage_bucket: string;
          storage_path: string;
          engine: string | null;
          engine_meta: unknown | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          feature_key: string;
          mode?: string;
          prompt: string;
          negative_prompt?: string | null;
          prompt_hash: string;
          width?: number | null;
          height?: number | null;
          steps?: number | null;
          storage_bucket: string;
          storage_path: string;
          engine?: string | null;
          engine_meta?: unknown | null;
        };
        Update: {
          feature_key?: string;
          mode?: string;
          prompt?: string;
          negative_prompt?: string | null;
          prompt_hash?: string;
          width?: number | null;
          height?: number | null;
          steps?: number | null;
          storage_bucket?: string;
          storage_path?: string;
          engine?: string | null;
          engine_meta?: unknown | null;
        };
        Relationships: [];
      };
      ai_generated_content: {
        Row: {
          id: string;
          nickname: string | null;
          content_type: "insight_card" | "warm_message" | "weekly_summary";
          content: string;
          meta: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          nickname?: string | null;
          content_type: "insight_card" | "warm_message" | "weekly_summary";
          content: string;
          meta?: unknown;
          created_at?: string;
        };
        Update: {
          nickname?: string | null;
          content_type?: "insight_card" | "warm_message" | "weekly_summary";
          content?: string;
          meta?: unknown;
        };
        Relationships: [];
      };
      experiment_control: {
        Row: {
          id: number;
          ended: boolean;
          ended_at: string | null;
          ended_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          ended?: boolean;
          ended_at?: string | null;
          ended_by?: string | null;
          updated_at?: string;
        };
        Update: {
          ended?: boolean;
          ended_at?: string | null;
          ended_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gemini_rate_counters: {
        Row: {
          rate_key: string;
          window_start: string;
          call_count: number;
        };
        Insert: {
          rate_key: string;
          window_start: string;
          call_count?: number;
        };
        Update: {
          call_count?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      try_consume_gemini_rate: {
        Args: { p_max: number; p_rate_key: string; p_window_start: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
