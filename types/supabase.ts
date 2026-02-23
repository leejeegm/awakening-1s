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
        };
        Insert: {
          id?: string;
          created_at?: string;
          nickname: string;
          note: string;
          duration_type?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          nickname?: string;
          note?: string;
          duration_type?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
