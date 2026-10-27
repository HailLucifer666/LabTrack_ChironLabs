import { NextResponse } from "next/server";
import { seedCases } from "@/lib/seed-data";
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
    item = {
      id: data.id,
      reference: data.reference,
      clinicName: data.clinic_name,
      clinicEmail: data.clinic_email,
      caseType: data.case_type,
      dueDate: data.due_date,
      status: data.status,
      notificationStatus: data.notification_status || "NOT_SENT",
      updatedAt: data.updated_at,
    };
  } else {
    const body = await request.json().catch(() => ({}));
    const submitted = body?.case as LabCase | undefined;
    item = submitted && submitted.id === id ? submitted : seedCases.find((candidate) => candidate.id === id);
  }
  if (!item) return NextResponse.json({ error: "Case not found." }, { status: 404 });
  if (item.status !== "READY") return NextResponse.json({ error: "Mark the case ready before notifying the clinic." }, { status: 409 });
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
        await supabase!.from("cases").update({ notification_status: "SENT", updated_at: new Date().toISOString() }).eq("id", id);
      }
      return NextResponse.json({ ok: true, mode: "live", status: "SENT", email: { to: email.to, subject: email.subject }, providerMessageId: result.id || null });
    } catch {
      return NextResponse.json({ error: "Could not reach the email provider. No successful send was confirmed." }, { status: 502 });
    }
  }

  if (databaseConfigured) {
    const supabase = getSupabaseServer();
    await supabase!.from("cases").update({ notification_status: "PREVIEWED", updated_at: new Date().toISOString() }).eq("id", id);
  }
  return NextResponse.json({ ok: true, mode: "test", status: "PREVIEWED", email, notice: previewNotice(decision.reason) });
}
