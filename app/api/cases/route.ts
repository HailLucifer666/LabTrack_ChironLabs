import { NextResponse } from "next/server";
import { seedCases } from "@/lib/seed-data";
import { todayDateInTimeZone } from "@/lib/date";
import { fromDbCase } from "@/lib/case-mapping";
import { getSupabaseServer, isDatabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const timeZone = process.env.LAB_TIME_ZONE || "Asia/Kolkata";
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase!.from("cases").select("*").order("due_date", { ascending: true });
    if (error) {
      return NextResponse.json({ error: "Could not load cases from the configured database." }, { status: 500 });
    }
    const cases = (data || []).map((row) => fromDbCase(row));
    return NextResponse.json({ cases, todayDate: todayDateInTimeZone(timeZone), dataMode: "database", labTimeZone: timeZone });
  }
  return NextResponse.json({ cases: seedCases, todayDate: todayDateInTimeZone(timeZone), dataMode: "demo", labTimeZone: timeZone });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clinicName !== "string" || typeof body.clinicEmail !== "string" || typeof body.caseType !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate || "")) {
    return NextResponse.json({ error: "Provide a clinic, valid email, case type and date-only due date." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.clinicEmail)) {
    return NextResponse.json({ error: "Provide a valid clinic email address." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : `case-${Date.now()}`;
  const reference = typeof body.reference === "string" ? body.reference : `LT-${Date.now().toString().slice(-5)}`;
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase!.from("cases").insert({
      id, reference, clinic_name: body.clinicName.trim(), clinic_email: body.clinicEmail.trim(),
      case_type: body.caseType, due_date: body.dueDate, status: "IN_PROGRESS", notification_status: "NOT_SENT",
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Could not create the case in the database." }, { status: 400 });
    return NextResponse.json({ ok: true, persisted: true, case: fromDbCase(data) }, { status: 201 });
  }
  return NextResponse.json({ ok: true, persisted: false, mode: "demo", case: {
    id, reference, clinicName: body.clinicName.trim(), clinicEmail: body.clinicEmail.trim(), caseType: body.caseType,
    dueDate: body.dueDate, status: "IN_PROGRESS", notificationStatus: "NOT_SENT", updatedAt: new Date().toISOString(),
  } }, { status: 201 });
}
