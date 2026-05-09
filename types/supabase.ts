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
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          note: string;
          duration_type?: string;
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
          is_public?: boolean;
          moderation_state?: "ok" | "deleted";
          moderation_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          purge_hold?: boolean;
        };
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
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
