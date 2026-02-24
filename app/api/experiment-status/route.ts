import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ended: false });
  }
  const { data, error } = await admin
    .from("experiment_control")
    .select("ended")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ended: false });
  }
  return NextResponse.json({ ended: !!data.ended });
}
