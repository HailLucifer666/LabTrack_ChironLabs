import { NextResponse } from "next/server";
import { seedCases } from "@/lib/seed-data";
import { todayDateInTimeZone, isValidDateOnly, resolveTimeZone } from "@/lib/date";
import { fromDbCase } from "@/lib/case-mapping";
import { getSupabaseServer, isDatabaseConfigured } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  const timeZone = resolveTimeZone();
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
  // Trim before validating: whitespace-only input is absent input, and every
  // stored field must be the value that was checked.
  const clinicName = typeof body?.clinicName === "string" ? body.clinicName.trim() : "";
  const clinicEmail = typeof body?.clinicEmail === "string" ? body.clinicEmail.trim() : "";
  const caseType = typeof body?.caseType === "string" ? body.caseType.trim() : "";
  if (!body || !clinicName || !clinicEmail || !caseType || !isValidDateOnly(body.dueDate)) {
    return NextResponse.json({ error: "Provide a clinic, valid email, case type and date-only due date." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clinicEmail)) {
    return NextResponse.json({ error: "Provide a valid clinic email address." }, { status: 400 });
  }
  if (body.id !== undefined && (typeof body.id !== "string" || !body.id.trim())) {
    return NextResponse.json({ error: "A supplied case id must be a non-empty string." }, { status: 400 });
  }
  if (body.reference !== undefined && (typeof body.reference !== "string" || !body.reference.trim())) {
    return NextResponse.json({ error: "A supplied case reference must be a non-empty string." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : `case-${Date.now()}`;
  const reference = typeof body.reference === "string" ? body.reference.trim() : `LT-${Date.now().toString().slice(-5)}`;
  // Demo has no server-side case table, so the seed set is the only collision it
  // can detect. A client can still reuse an id it created earlier in its own
  // localStorage; that limitation is inherent to the demo and documented.
  if (!isDatabaseConfigured() && seedCases.some((item) => item.id === id)) {
    return NextResponse.json({ error: "That case id already exists in the demo data." }, { status: 409 });
  }
  if (isDatabaseConfigured()) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase!.from("cases").insert({
      id, reference, clinic_name: clinicName, clinic_email: clinicEmail,
      case_type: caseType, due_date: body.dueDate, status: "IN_PROGRESS", notification_status: "NOT_SENT",
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error || !data) return NextResponse.json({ error: "Could not create the case in the database." }, { status: 400 });
    return NextResponse.json({ ok: true, persisted: true, case: fromDbCase(data) }, { status: 201 });
  }
  return NextResponse.json({ ok: true, persisted: false, mode: "demo", case: {
    id, reference, clinicName, clinicEmail, caseType,
    dueDate: body.dueDate, status: "IN_PROGRESS", notificationStatus: "NOT_SENT", updatedAt: new Date().toISOString(),
  } }, { status: 201 });
}
