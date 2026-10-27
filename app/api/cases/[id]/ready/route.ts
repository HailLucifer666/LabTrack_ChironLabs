import { NextResponse } from "next/server";
import { seedCases } from "@/lib/seed-data";
import { fromDbCase } from "@/lib/case-mapping";
import { getSupabaseServer, isDatabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase!
      .from("cases")
      .update({ status: "READY", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Could not mark this case ready." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, persisted: true, case: fromDbCase(data) });
  }
  const body = await request.json().catch(() => ({}));
  const submitted = body?.case;
  const existing = seedCases.find((item) => item.id === id);
  if (!existing && submitted?.id !== id) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  // Demo fallback: the browser stores case changes locally. No server-side DB is implied.
  return NextResponse.json({ ok: true, persisted: false, mode: "demo" });
}
