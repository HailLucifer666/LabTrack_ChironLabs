"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatDateOnly, isCaseOverdue, isValidDateOnly } from "@/lib/date";
import { sanitizeStoredCases } from "@/lib/demo-state";
import type { CaseListResponse, EmailPreview, LabCase } from "@/lib/types";

type Filter = "ALL" | "IN_PROGRESS" | "READY" | "OVERDUE";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;

function Icon({ name, size = 18 }: { name: "logo" | "search" | "plus" | "calendar" | "mail" | "check" | "clock" | "alert" | "arrow" | "filter" | "close" | "external"; size?: number }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "logo": return <svg {...shared}><path d="M12 3.5c-3.8-2.4-8.3.3-8.3 4.8 0 5.4 5 7.9 6.6 12.2.6 1.7 2.1 1.7 2.7 0 1.6-4.3 6.6-6.8 6.6-12.2 0-4.5-4.5-7.2-8.3-4.8Z"/><path d="M8 9.5h8M12 6v7"/></svg>;
    case "search": return <svg {...shared}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></svg>;
    case "plus": return <svg {...shared}><path d="M12 5v14M5 12h14"/></svg>;
    case "calendar": return <svg {...shared}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17"/></svg>;
    case "mail": return <svg {...shared}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
    case "check": return <svg {...shared}><path d="m5 12.5 4.4 4.2L19 7"/></svg>;
    case "clock": return <svg {...shared}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
    case "alert": return <svg {...shared}><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>;
    case "arrow": return <svg {...shared}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "filter": return <svg {...shared}><path d="M4 6h16M7 12h10m-7 6h4"/></svg>;
    case "close": return <svg {...shared}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case "external": return <svg {...shared}><path d="M14 4h6v6M20 4 11 13"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>;
  }
}

function getDisplayStatus(item: LabCase, todayDate: string | null): { label: string; className: string; overdue: boolean } {
  const overdue = todayDate !== null && isCaseOverdue(item.dueDate, item.status, todayDate);
  if (overdue) return { label: "Overdue", className: "status-overdue", overdue: true };
  if (item.status === "READY") return { label: "Ready", className: "status-ready", overdue: false };
  return { label: "In progress", className: "status-progress", overdue: false };
}

export default function Dashboard() {
  const [cases, setCases] = useState<LabCase[]>([]);
  const [todayDate, setTodayDate] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<"database" | "demo">("demo");
  const [labTimeZone, setLabTimeZone] = useState("Asia/Kolkata");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [emailMode, setEmailMode] = useState<"test" | "live" | null>(null);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [newCase, setNewCase] = useState({ clinicName: "", clinicEmail: "", caseType: "Zirconia crown", dueDate: "2026-11-03" });

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/cases", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load cases.");
      const payload = (await response.json()) as CaseListResponse;
      setTodayDate(payload.todayDate);
      setDataMode(payload.dataMode);
      setLabTimeZone(payload.labTimeZone);
      let nextCases = payload.cases;
      if (payload.dataMode === "demo") {
        try {
          const local = window.localStorage.getItem("labtrack-cases-v1");
          if (local) {
            const sanitized = sanitizeStoredCases(JSON.parse(local));
            if (sanitized) nextCases = sanitized;
          }
        } catch { /* Ignore invalid browser-local demo state and use server seed data. */ }
      }
      setCases(nextCases);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to load cases." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const persistDemoCases = (nextCases: LabCase[]) => {
    if (dataMode === "demo") {
      try { window.localStorage.setItem("labtrack-cases-v1", JSON.stringify(nextCases)); } catch { /* Demo remains usable for this session if storage is unavailable. */ }
    }
  };

  const decoratedCases = useMemo(() => cases.map((item) => ({ item, display: getDisplayStatus(item, todayDate) })), [cases, todayDate]);
  const counts = useMemo(() => ({
    total: cases.length,
    progress: decoratedCases.filter(({ item }) => item.status === "IN_PROGRESS").length,
    ready: decoratedCases.filter(({ item }) => item.status === "READY").length,
    overdue: decoratedCases.filter(({ display }) => display.overdue).length,
  }), [cases, decoratedCases]);

  const visibleCases = useMemo(() => decoratedCases.filter(({ item, display }) => {
    const searchable = `${item.reference} ${item.clinicName} ${item.caseType}`.toLowerCase();
    if (query.trim() && !searchable.includes(query.trim().toLowerCase())) return false;
    if (filter === "IN_PROGRESS" && item.status !== "IN_PROGRESS") return false;
    if (filter === "READY" && item.status !== "READY") return false;
    if (filter === "OVERDUE" && !display.overdue) return false;
    return true;
  }).sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate)), [decoratedCases, query, filter]);

  async function markReady(item: LabCase) {
    setBusyId(item.id); setNotice(null);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(item.id)}/ready`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case: item }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update case status.");
      const nextCases = cases.map((entry) => entry.id === item.id ? { ...entry, status: "READY" as const, updatedAt: new Date().toISOString() } : entry);
      setCases(nextCases); persistDemoCases(nextCases);
      setNotice({ kind: "success", text: `${item.reference} marked ready. You can now notify the clinic.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update case status." });
    } finally { setBusyId(null); }
  }

  async function notifyClinic(item: LabCase) {
    setBusyId(item.id); setNotice(null); setPreview(null);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(item.id)}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case: item }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Notification could not be prepared.");
      setEmailMode(result.mode);
      setPreview(result.email || null);
      // In database mode `persisted:false` means the PREVIEWED write failed, so
      // do not mark the row as notified locally — that would be a success claim
      // the next reload silently retracts. In demo mode the browser's own
      // localStorage is the store, so `persisted:false` from the server is expected.
      const statusSaved = dataMode === "demo" || result.persisted === true;
      if (statusSaved) {
        const nextCases = cases.map((entry) => entry.id === item.id ? { ...entry, notificationStatus: result.status, updatedAt: new Date().toISOString() } : entry);
        setCases(nextCases); persistDemoCases(nextCases);
      }
      const baseNotice = result.mode === "test" ? "Test-mode preview created. No email was delivered." : "Email provider accepted the notification.";
      setNotice({
        kind: result.mode === "test" ? "info" : "success",
        text: statusSaved ? baseNotice : `${baseNotice} The case status could not be saved — reload before retrying.`,
      });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Notification could not be sent." });
    } finally { setBusyId(null); }
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCase.clinicName.trim() || !newCase.clinicEmail.trim() || !isValidDateOnly(newCase.dueDate)) {
      setNotice({ kind: "error", text: "Enter a clinic, valid email and a real calendar due date." }); return;
    }
    const existingNumbers = cases.map((item) => Number(item.reference.replace(/\D/g, ""))).filter(Number.isFinite);
    const reference = `LT-${Math.max(1040, ...existingNumbers) + 1}`;
    const draft = {
      id: `case-${Date.now()}`, reference, clinicName: newCase.clinicName.trim(), clinicEmail: newCase.clinicEmail.trim(),
      caseType: newCase.caseType, dueDate: newCase.dueDate,
    };
    try {
      const response = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create case.");
      const item: LabCase = result.case;
      const nextCases = [item, ...cases];
      setCases(nextCases); persistDemoCases(nextCases); setIsNewCaseOpen(false);
      setNewCase({ clinicName: "", clinicEmail: "", caseType: "Zirconia crown", dueDate: "2026-11-03" });
      setNotice({ kind: "success", text: `${item.reference} added${dataMode === "demo" ? " to this browser's demo data" : " to the database"}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not create case." });
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="LabTrack home">
          <span className="brand-mark"><Icon name="logo" size={25} /></span>
          <span className="brand-name">labtrack<span>.</span><small>LAB OPERATIONS</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Primary navigation">
          <a className={`nav-link ${filter === "ALL" ? "active" : ""}`} href="#cases" aria-current={filter === "ALL" ? "page" : undefined}><span className="nav-icon"><Icon name="calendar" /></span>Cases <span className="nav-count">{counts.total}</span></a>
          <a className={`nav-link muted-link ${filter === "READY" ? "active" : ""}`} href="#cases" aria-current={filter === "READY" ? "page" : undefined} onClick={() => { setFilter("READY"); setQuery(""); }}><span className="nav-icon"><Icon name="check" /></span>Ready for clinic</a>
          <a className={`nav-link muted-link ${filter === "OVERDUE" ? "active" : ""}`} href="#cases" aria-current={filter === "OVERDUE" ? "page" : undefined} onClick={() => { setFilter("OVERDUE"); setQuery(""); }}><span className="nav-icon"><Icon name="alert" /></span>Overdue cases{counts.overdue > 0 && <span className="nav-dot" />}</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">?</div>
          <div><strong>Need a hand?</strong><span>Check the quick-start guide</span><a href="https://github.com" target="_blank" rel="noreferrer">View docs <Icon name="external" size={12} /></a></div>
        </div>
        <div className="user-card"><div className="avatar">ML</div><div className="user-detail"><strong>Maria Lopez</strong><span>Lab administrator</span></div><span className="user-menu">•••</span></div>
      </aside>

      <section className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Cases</strong></div>
          <div className="topbar-actions"><span className={`mode-indicator ${dataMode === "demo" ? "is-demo" : "is-live"}`}><span />{dataMode === "demo" ? "Demo workspace" : "Database connected"}</span><div className="top-avatar">ML</div></div>
        </header>

        <div className="page-content" id="cases">
          <div className="page-heading">
            <div><div className="eyebrow">LAB OPERATIONS {todayDate && <><span aria-hidden="true">/</span> {formatDateOnly(todayDate).toUpperCase()}</>}</div><h1>Case overview</h1><p>Your lab at a glance. Prioritise production, deadlines and clinic handoffs.</p></div>
            <button className="primary-button" onClick={() => setIsNewCaseOpen(true)}><Icon name="plus" size={17} /> New case</button>
          </div>

          {dataMode === "demo" && <div className="demo-banner"><span className="demo-banner-icon"><Icon name="alert" size={15} /></span><div><strong>Demo mode is on</strong><span>Sample data is stored in this browser. Email notifications open a preview and are not delivered.</span></div><button onClick={() => { window.localStorage.removeItem("labtrack-cases-v1"); void reload(); setNotice({ kind: "info", text: "Demo data reset to the original sample cases." }); }}>Reset sample data</button></div>}

          <div className="metrics-grid" aria-label="Case summary">
            <Metric label="Total cases" value={counts.total} detail="Across all clinics" icon="calendar" tone="slate" />
            <Metric label="In progress" value={counts.progress} detail="Currently in production" icon="clock" tone="blue" />
            <Metric label="Ready for clinic" value={counts.ready} detail="Awaiting collection" icon="check" tone="green" />
            <Metric label="Overdue" value={counts.overdue} detail="Needs attention" icon="alert" tone="amber" />
          </div>

          <section className="cases-panel" aria-labelledby="cases-title">
            <div className="panel-header"><div><h2 id="cases-title">All cases</h2><p>Review status, deadlines and clinic updates.</p></div><span className="case-total">{visibleCases.length} cases</span></div>
            <div className="toolbar">
              <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search cases" placeholder="Search case or clinic..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
              <label className="filter-box"><Icon name="filter" size={16} /><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="ALL">All statuses</option><option value="IN_PROGRESS">In progress</option><option value="READY">Ready</option><option value="OVERDUE">Overdue</option></select></label>
            </div>

            {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Icon name="check" size={16} /> : notice.kind === "error" ? <Icon name="alert" size={16} /> : <Icon name="mail" size={16} />}</span><div>{notice.text}</div><button aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={15} /></button></div>}

            <div className="table-wrap">
              <table className="case-table">
                <thead><tr><th>CASE / TYPE</th><th>CLINIC</th><th>DUE DATE</th><th>STATUS</th><th>NOTIFICATION</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {isLoading ? <tr><td colSpan={6}><div className="table-state"><span className="spinner" />Loading cases…</div></td></tr> : visibleCases.length === 0 ? <tr><td colSpan={6}><div className="table-state"><div className="empty-symbol"><Icon name="search" size={20} /></div><strong>No cases found</strong><span>Try a different search or clear the status filter.</span><button className="text-button" onClick={() => { setQuery(""); setFilter("ALL"); }}>Clear filters</button></div></td></tr> : visibleCases.map(({ item, display }) => (
                    <tr key={item.id}>
                      <td><div className="case-cell"><span className="case-avatar">{item.caseType.toLowerCase().includes("bridge") ? "BR" : item.caseType.toLowerCase().includes("implant") ? "IM" : item.caseType.toLowerCase().includes("guard") ? "NG" : "CR"}</span><div><strong className="case-ref">{item.reference}</strong><span className="case-type">{item.caseType}</span></div></div></td>
                      <td><div className="clinic-cell"><strong>{item.clinicName}</strong><span>{item.clinicEmail}</span></div></td>
                      <td><div className={`due-date ${display.overdue ? "due-overdue" : ""}`}><Icon name="calendar" size={14} /><span>{formatDateOnly(item.dueDate)}</span></div>{display.overdue && <span className="overdue-caption">Past due</span>}</td>
                      <td><span className={`status-pill ${display.className}`}><span />{display.label}</span></td>
                      <td><NotificationLabel status={item.notificationStatus} /></td>
                      <td><div className="row-actions">{item.status !== "READY" ? <button className="small-action" disabled={busyId === item.id} onClick={() => void markReady(item)}>{busyId === item.id ? <span className="spinner mini" /> : <Icon name="check" size={14} />} Mark ready</button> : item.notificationStatus === "SENT" ? <button className="small-action" disabled title="A live notification has already been sent"><Icon name="check" size={14} /> Sent</button> : <button className="small-action notify-action" disabled={busyId === item.id} onClick={() => void notifyClinic(item)}>{busyId === item.id ? <span className="spinner mini" /> : <Icon name="mail" size={14} />} Notify</button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>{visibleCases.length}</strong> of <strong>{cases.length}</strong> cases</span><span className="footer-timezone" title={`Overdue status is calculated using ${labTimeZone}`}><Icon name="calendar" size={13} /> Due dates are calendar dates</span></div>
          </section>
          <footer className="page-footer"><span>© 2026 LabTrack · Dental lab operations</span><span>Built for clarity. Designed for the workbench.</span></footer>
        </div>
      </section>

      {preview && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><section className="email-modal" role="dialog" aria-modal="true" aria-labelledby="email-preview-title"><div className="modal-top"><div className="modal-icon"><Icon name="mail" size={20} /></div><button className="icon-button" onClick={() => setPreview(null)} aria-label="Close email preview"><Icon name="close" /></button></div><div className="modal-heading"><span className={`mode-chip ${emailMode === "test" ? "chip-test" : "chip-live"}`}>{emailMode === "test" ? "TEST MODE · NOT SENT" : "LIVE EMAIL ACCEPTED"}</span><h2 id="email-preview-title">Clinic notification</h2><p>Review the message generated for this case.</p></div><div className="email-fields"><div><span>To</span><strong>{preview.to}</strong></div><div><span>Subject</span><strong>{preview.subject}</strong></div><div className="email-body"><span>Message</span><pre>{preview.text}</pre></div></div>{emailMode === "test" && <div className="test-warning"><Icon name="alert" size={16} /><span>This is only a preview. No email was delivered to the clinic.</span></div>}<div className="modal-actions"><button className="secondary-button" onClick={() => { void navigator.clipboard?.writeText(`To: ${preview.to}\nSubject: ${preview.subject}\n\n${preview.text}`); setNotice({ kind: "success", text: "Email preview copied to clipboard." }); }}>Copy message</button><button className="primary-button" onClick={() => setPreview(null)}>Done</button></div></section></div>}

      {isNewCaseOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsNewCaseOpen(false); }}><section className="email-modal new-case-modal" role="dialog" aria-modal="true" aria-labelledby="new-case-title"><div className="modal-top"><div className="modal-icon"><Icon name="plus" size={20} /></div><button className="icon-button" onClick={() => setIsNewCaseOpen(false)} aria-label="Close new case form"><Icon name="close" /></button></div><div className="modal-heading"><h2 id="new-case-title">Create a case</h2><p>Add a synthetic demo case to the current dashboard.</p></div><form className="new-case-form" onSubmit={(event) => void createCase(event)}><label>Clinic name<input required value={newCase.clinicName} onChange={(e) => setNewCase((old) => ({ ...old, clinicName: e.target.value }))} placeholder="e.g. Westside Dental" /></label><label>Clinic email<input required type="email" value={newCase.clinicEmail} onChange={(e) => setNewCase((old) => ({ ...old, clinicEmail: e.target.value }))} placeholder="clinic@example.com" /></label><label>Case type<select value={newCase.caseType} onChange={(e) => setNewCase((old) => ({ ...old, caseType: e.target.value }))}><option>Zirconia crown</option><option>Ceramic crown</option><option>Bridge · 3-unit</option><option>Implant crown</option><option>Night guard</option><option>Aligner</option></select></label><label>Due date<input required type="date" value={newCase.dueDate} onChange={(e) => setNewCase((old) => ({ ...old, dueDate: e.target.value }))} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setIsNewCaseOpen(false)}>Cancel</button><button className="primary-button" type="submit">Create case <Icon name="arrow" size={15} /></button></div><p className="form-note">In demo mode, new cases are saved to this browser only. Database mode requires the Supabase setup in the README.</p></form></section></div>}
    </main>
  );
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: "calendar" | "clock" | "check" | "alert"; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon name={icon} size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></article>;
}

function NotificationLabel({ status }: { status: LabCase["notificationStatus"] }) {
  if (status === "SENT") return <span className="notification-state notification-sent"><Icon name="check" size={13} /> Sent</span>;
  if (status === "PREVIEWED") return <span className="notification-state notification-preview"><Icon name="mail" size={13} /> Previewed</span>;
  if (status === "FAILED") return <span className="notification-state notification-failed"><Icon name="alert" size={13} /> Failed</span>;
  return <span className="notification-state notification-none"><span className="notification-dot" /> Not sent</span>;
}
