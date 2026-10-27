import { NextResponse } from "next/server";
import { seedCases } from "@/lib/seed-data";
import { fromDbCase } from "@/lib/case-mapping";
import { getSupabaseServer, isDatabaseConfigured } from "@/lib/supabase-server";
import { decideNotification, previewNotice } from "@/lib/notify-decision";
import type { LabCase } from "@/lib/types";

export const runtime = "nodejs";

function escapeHtml(input: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return input.replace(/[&<>\"']/g, (char) => entities[char] || char);
}

function emailForCase(item: LabCase) {
  const subject = `LabTrack: Case ${item.reference} is ready`;
  const text = [
    "Hello,",
    "",
    `Your dental lab case ${item.reference} (${item.caseType}) is now marked ready.`,
    "Please contact the laboratory if you have any questions about collection or next steps.",
    "",
    "Regards,",
    "LabTrack Dental Laboratory",
  ].join("\n");
  const html = `<p>Hello,</p><p>Your dental lab case <strong>${escapeHtml(item.reference)}</strong> (${escapeHtml(item.caseType)}) is now marked ready.</p><p>Please contact the laboratory if you have any questions about collection or next steps.</p><p>Regards,<br/>LabTrack Dental Laboratory</p>`;
  return { to: item.clinicEmail, subject, text, html };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const databaseConfigured = isDatabaseConfigured();
  let item: LabCase | undefined;
  if (databaseConfigured) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase!.from("cases").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Case not found." }, { status: 404 });
    item = fromDbCase(data);
  } else {
    const body = await request.json().catch(() => ({}));
    const submitted = body?.case as LabCase | undefined;
    item = submitted && submitted.id === id ? submitted : seedCases.find((candidate) => candidate.id === id);
  }
  if (!item) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  if (item.status !== "READY") return NextResponse.json({ error: "Mark the case ready before notifying the clinic." }, { status: 409 });
  // Deliberate non-fix (2026-10-27): in database mode this read-check-send-write
  // sequence is raceable — two concurrent requests can both read NOT_SENT and both
  // send. Closing it needs an atomic claim (conditional UPDATE or an RPC) proven
  // against a real Supabase project; this build is demo-only and no database is
  // configured, so the race is documented here rather than half-fixed. Revisit
  // before any live deployment.
  if (item.notificationStatus === "SENT") return NextResponse.json({ error: "A live notification has already been sent for this case." }, { status: 409 });
  if (!item.clinicEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.clinicEmail)) {
    return NextResponse.json({ error: "This case has no valid clinic email address." }, { status: 400 });
  }

  const email = emailForCase(item);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const decision = decideNotification(item, {
    databaseConfigured,
    providerConfigured: Boolean(apiKey && from),
  });

  if (decision.action === "send") {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return NextResponse.json({ error: "Email provider rejected the message. Check server-side email configuration.", providerStatus: response.status }, { status: 502 });
      if (databaseConfigured) {
        const supabase = getSupabaseServer();
        const { error: updateError } = await supabase!.from("cases").update({ notification_status: "SENT", updated_at: new Date().toISOString() }).eq("id", id);
        if (updateError) {
          console.error("notify: provider accepted the message but the SENT status write failed", updateError);
          return NextResponse.json({ error: "The email provider accepted the message, but the case status could not be saved. Do not retry without checking the database.", partial: true }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true, mode: "live", status: "SENT", email: { to: email.to, subject: email.subject }, providerMessageId: result.id || null });
    } catch {
      return NextResponse.json({ error: "Could not reach the email provider. No successful send was confirmed." }, { status: 502 });
    }
  }

  let persisted = false;
  if (databaseConfigured) {
    const supabase = getSupabaseServer();
    const { error: updateError } = await supabase!.from("cases").update({ notification_status: "PREVIEWED", updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) console.error("notify: PREVIEWED status write failed", updateError);
    else persisted = true;
  }
  return NextResponse.json({ ok: true, mode: "test", status: "PREVIEWED", persisted, email, notice: previewNotice(decision.reason) });
}
