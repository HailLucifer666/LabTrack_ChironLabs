"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatDateOnly, isCaseOverdue, isDueToday, isValidDateOnly } from "@/lib/date";
import { sanitizeStoredCases } from "@/lib/demo-state";
import type { CaseListResponse, EmailPreview, LabCase } from "@/lib/types";

type Filter = "ALL" | "IN_PROGRESS" | "READY" | "OVERDUE";
type Notice = { kind: "success" | "error" | "info"; text: string } | null;
/** Production status and the deadline condition are separate product concepts:
 * status is where the case is in the lab; deadline is where it is against the
 * calendar. A ready case can still be past due (needs collecting), and an
 * in-progress case overdue (needs work) — neither is folded into the other. */
type DeadlineKind = "overdue" | "today" | "upcoming";
type DisplayCondition = {
  status: "IN_PROGRESS" | "READY";
  deadline: DeadlineKind;
  overdue: boolean;
};
type IconName =
  | "logo"
  | "menu"
  | "close"
  | "search"
  | "plus"
  | "calendar"
  | "mail"
  | "check"
  | "clock"
  | "alert"
  | "arrow"
  | "external"
  | "copy"
  | "refresh"
  | "shield"
  | "inbox"
  | "chevron";

type Counts = { total: number; progress: number; ready: number; overdue: number };
type DecoratedCase = { item: LabCase; display: ReturnType<typeof getDisplayStatus> };
type TimelineDay = {
  key: string;
  weekday: string;
  dayNumber: string;
  entries: DecoratedCase[];
  isToday: boolean;
  isPast: boolean;
  label: string;
};
type TimelineData = {
  days: TimelineDay[];
  first: string;
  last: string;
  todayKey: string;
  outside: number;
  total: number;
};

const DAYS_PAST = 3;
const DAYS_AHEAD = 10;
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const SIDEBAR_PREF_KEY = "labtrack-sidebar-visibility-v1";
const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "logo":
      return (
        <svg {...shared}>
          <path d="M12 3.5c-3.8-2.4-8.3.3-8.3 4.8 0 5.4 5 7.9 6.6 12.2.6 1.7 2.1 1.7 2.7 0 1.6-4.3 6.6-6.8 6.6-12.2 0-4.5-4.5-7.2-8.3-4.8Z" />
          <path d="M8 9.5h8M12 6v7" />
        </svg>
      );
    case "menu":
      return <svg {...shared}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "search":
      return <svg {...shared}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>;
    case "plus":
      return <svg {...shared}><path d="M12 5v14M5 12h14" /></svg>;
    case "calendar":
      return <svg {...shared}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" /></svg>;
    case "mail":
      return <svg {...shared}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "check":
      return <svg {...shared}><path d="m5 12.5 4.4 4.2L19 7" /></svg>;
    case "clock":
      return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "alert":
      return <svg {...shared}><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "arrow":
      return <svg {...shared}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "close":
      return <svg {...shared}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case "external":
      return <svg {...shared}><path d="M14 4h6v6M20 4 11 13" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg>;
    case "copy":
      return <svg {...shared}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>;
    case "refresh":
      return <svg {...shared}><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 4v7h-7" /></svg>;
    case "shield":
      return <svg {...shared}><path d="M12 3 5 6v5c0 4.4 2.9 7.6 7 10 4.1-2.4 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "inbox":
      return <svg {...shared}><path d="M3 13h5l2 2h4l2-2h5" /><path d="M5 5h14l2 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4l2-8Z" /></svg>;
    case "chevron":
      return <svg {...shared}><path d="m7 10 5 5 5-5" /></svg>;
  }
}

function getDisplayStatus(item: LabCase, todayDate: string | null): DisplayCondition {
  const overdue = todayDate !== null && isCaseOverdue(item.dueDate, todayDate);
  const dueToday = !overdue && todayDate !== null && isDueToday(item.dueDate, todayDate);
  const deadline: DeadlineKind = overdue ? "overdue" : dueToday ? "today" : "upcoming";
  return { status: item.status, deadline, overdue };
}

function dateOnlyToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function shiftDateOnly(value: string, days: number): string | null {
  const date = dateOnlyToUtc(value);
  if (!date) return null;
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

function formatRange(first: string, last: string): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  if (!sameYear) return `${formatDateOnly(first)} – ${formatDateOnly(last)}`;
  const firstDate = dateOnlyToUtc(first);
  const lastDate = dateOnlyToUtc(last);
  if (!firstDate || !lastDate) return `${formatDateOnly(first)} – ${formatDateOnly(last)}`;
  return `${SHORT_DATE.format(firstDate)} – ${SHORT_DATE.format(lastDate)} ${last.slice(0, 4)}`;
}

function buildTimeline(decorated: DecoratedCase[], todayDate: string | null): TimelineData | null {
  if (!todayDate) return null;
  const days: TimelineDay[] = [];
  for (let index = 0; index < DAYS_PAST + DAYS_AHEAD + 1; index += 1) {
    const key = shiftDateOnly(todayDate, index - DAYS_PAST);
    const date = key ? dateOnlyToUtc(key) : null;
    if (!key || !date) return null;
    days.push({
      key,
      weekday: WEEKDAY_INITIALS[date.getUTCDay()],
      dayNumber: String(date.getUTCDate()).padStart(2, "0"),
      entries: decorated.filter(({ item }) => item.dueDate === key),
      isToday: key === todayDate,
      isPast: key < todayDate,
      label: LONG_DATE.format(date),
    });
  }
  const first = days[0].key;
  const last = days[days.length - 1].key;
  const outside = decorated.filter(({ item }) => item.dueDate < first || item.dueDate > last).length;
  return { days, first, last, todayKey: todayDate, outside, total: decorated.length };
}

function timelineNote(data: TimelineData): string {
  if (data.total === 0) return "No cases in the workspace yet.";
  if (data.outside === 0) return `All ${data.total} deadlines fall inside this window.`;
  return `${data.outside} case${data.outside === 1 ? "" : "s"} fall${data.outside === 1 ? "s" : ""} outside this window.`;
}

function caseTag(caseType: string): string {
  const value = caseType.toLowerCase();
  if (value.includes("bridge")) return "BR";
  if (value.includes("implant")) return "IM";
  if (value.includes("guard")) return "NG";
  return "CR";
}

function timelineDotClass(display: ReturnType<typeof getDisplayStatus>): string {
  if (display.overdue) return "dot-overdue";
  if (display.deadline === "today") return "dot-today";
  if (display.status === "READY") return "dot-ready";
  return "dot-progress";
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
  const [copied, setCopied] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [newCase, setNewCase] = useState({ clinicName: "", clinicEmail: "", caseType: "Zirconia crown", dueDate: "2026-11-03" });
  const searchRef = useRef<HTMLInputElement>(null);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const pendingSidebarFocusRef = useRef(false);

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

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!isNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    const toggle = navToggleRef.current;
    const sidebar = sidebarRef.current;
    document.body.style.overflow = "hidden";
    sidebar?.querySelector<HTMLElement>(".nav-link")?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNavOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebar) return;
      const nodes = Array.from(sidebar.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((node) => node.getClientRects().length > 0);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!sidebar.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      toggle?.focus();
    };
  }, [isNavOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const handleChange = () => { if (desktop.matches) setIsNavOpen(false); };
    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, []);

  // The stored preference is read after mount: reading it during the first
  // render would make the server markup and the client render disagree.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    try {
      if (desktop.matches && window.localStorage.getItem(SIDEBAR_PREF_KEY) === "collapsed") {
        setIsSidebarCollapsed(true);
      }
    } catch { /* Storage unavailable — the sidebar just starts expanded. */ }
  }, []);

  const toggleSidebarCollapsed = () => {
    const next = !isSidebarCollapsed;
    pendingSidebarFocusRef.current = !next; // expand: move focus into the sidebar once it is visible again
    setIsSidebarCollapsed(next);
    try { window.localStorage.setItem(SIDEBAR_PREF_KEY, next ? "collapsed" : "expanded"); } catch { /* Session-only fallback. */ }
    // When collapsing, the button keeps native click focus, so the attention
    // pointer survives the sidebar leaving the accessibility tree.
  };

  // Runs after the class change is committed, so the sidebar is visible and
  // focusable again before it receives focus. The pending flag keeps the
  // mount-time restore (from localStorage) from stealing focus.
  useEffect(() => {
    if (!pendingSidebarFocusRef.current) return;
    pendingSidebarFocusRef.current = false;
    if (!isSidebarCollapsed) {
      sidebarRef.current?.querySelector<HTMLElement>(".nav-link")?.focus();
    }
  }, [isSidebarCollapsed]);

  const persistDemoCases = (nextCases: LabCase[]) => {
    if (dataMode === "demo") {
      try { window.localStorage.setItem("labtrack-cases-v1", JSON.stringify(nextCases)); } catch { /* Demo remains usable for this session if storage is unavailable. */ }
    }
  };

  const decoratedCases = useMemo(() => cases.map((item) => ({ item, display: getDisplayStatus(item, todayDate) })), [cases, todayDate]);
  const counts = useMemo(() => ({
    // Overdue is a deadline condition, not a status: it counts cases past
    // their calendar due date regardless of whether they are in progress or
    // already ready, so the three cards can overlap by design.
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

  const timeline = useMemo(() => buildTimeline(decoratedCases, todayDate), [decoratedCases, todayDate]);

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
    // The row button disables itself while the request is in flight, which
    // blurs it; remember the trigger now so the dialog can restore focus.
    previewTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      setCopied(false);
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

  function resetDemoData() {
    try { window.localStorage.removeItem("labtrack-cases-v1"); } catch { /* Storage unavailable — reloading is still the right recovery. */ }
    void reload();
    setNotice({ kind: "info", text: "Demo data reset to the original sample cases." });
  }

  async function copyPreview() {
    if (!preview) return;
    const message = `To: ${preview.to}\nSubject: ${preview.subject}\n\n${preview.text}`;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard is not available in this browser.");
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setNotice({ kind: "success", text: "Email preview copied to clipboard." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not copy the preview." });
    }
  }

  const closePreview = useCallback(() => { setPreview(null); setCopied(false); }, []);
  const closeNewCase = useCallback(() => setIsNewCaseOpen(false), []);
  const clearFilters = useCallback(() => { setQuery(""); setFilter("ALL"); }, []);

  function applySidebarFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    setQuery("");
    setIsNavOpen(false);
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: counts.total },
    { value: "IN_PROGRESS", label: "In progress", count: counts.progress },
    { value: "READY", label: "Ready", count: counts.ready },
    { value: "OVERDUE", label: "Overdue", count: counts.overdue },
  ];

  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#cases">Skip to cases</a>

      <aside
        id="primary-sidebar"
        ref={sidebarRef}
        className={`sidebar${isNavOpen ? " is-open" : ""}${isSidebarCollapsed ? " is-collapsed" : ""}`}
        aria-label="Workspace navigation"
        role={isNavOpen ? "dialog" : undefined}
        aria-modal={isNavOpen ? true : undefined}
      >
        <div className="sidebar-head">
          <a className="brand" href="#top" aria-label="LabTrack home" onClick={() => setIsNavOpen(false)}>
            <span className="brand-mark"><Icon name="logo" size={24} /></span>
            <span className="brand-name">labtrack<span>.</span><small>LAB OPERATIONS</small></span>
          </a>
          <button type="button" className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setIsNavOpen(false)}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="side-nav" aria-label="Primary">
          <a className={`nav-link${filter === "ALL" ? " active" : ""}`} href="#cases" aria-current={filter === "ALL" ? "page" : undefined} onClick={() => applySidebarFilter("ALL")}>
            <span className="nav-icon"><Icon name="calendar" /></span>
            <span className="nav-text">Cases</span>
            <span className="nav-badge">{counts.total}</span>
          </a>
          <a className={`nav-link${filter === "READY" ? " active" : ""}`} href="#cases" aria-current={filter === "READY" ? "page" : undefined} onClick={() => applySidebarFilter("READY")}>
            <span className="nav-icon"><Icon name="check" /></span>
            <span className="nav-text">Ready for clinic</span>
            <span className="nav-badge">{counts.ready}</span>
          </a>
          <a className={`nav-link${filter === "OVERDUE" ? " active" : ""}`} href="#cases" aria-current={filter === "OVERDUE" ? "page" : undefined} onClick={() => applySidebarFilter("OVERDUE")}>
            <span className="nav-icon"><Icon name="alert" /></span>
            <span className="nav-text">Overdue cases</span>
            <span className={`nav-badge${counts.overdue > 0 ? " is-alert" : ""}`}>{counts.overdue}</span>
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="demo-guard">
          <span className="demo-guard-icon"><Icon name="shield" size={18} /></span>
          <div>
            <strong>Demo guard on</strong>
            <span>Sample data stays in this browser. Emails preview, never send.</span>
          </div>
        </div>
        <div className="user-card">
          <div className="avatar" aria-hidden="true">ML</div>
          <div className="user-detail"><strong>Maria Lopez</strong><span>Lab administrator</span></div>
        </div>
      </aside>

      {isNavOpen && <div className="nav-scrim" role="presentation" onClick={() => setIsNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button ref={navToggleRef} type="button" className="icon-button nav-toggle" aria-label="Open navigation" aria-expanded={isNavOpen} aria-controls="primary-sidebar" onClick={() => setIsNavOpen(true)}>
              <Icon name="menu" size={22} />
            </button>
            <button
              ref={sidebarToggleRef}
              type="button"
              className="icon-button sidebar-toggle"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isSidebarCollapsed}
              aria-controls="primary-sidebar"
              onClick={toggleSidebarCollapsed}
            >
              <Icon name="chevron" size={22} />
            </button>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span className="crumb-root">Workspace</span>
              <span className="crumb-sep" aria-hidden="true">/</span>
              <strong aria-current="page">Cases</strong>
            </nav>
          </div>
          <div className="topbar-actions">
            <span
              className={`mode-pill ${dataMode === "demo" ? "is-demo" : "is-live"}`}
              title={dataMode === "demo" ? `Demo workspace. Overdue dates use ${labTimeZone}.` : `Database connected. Overdue dates use ${labTimeZone}.`}
            >
              <span className="mode-dot" aria-hidden="true" />
              <span className="mode-full">{dataMode === "demo" ? "Demo workspace" : "Database connected"}</span>
              <span className="mode-short">{dataMode === "demo" ? "Demo" : "Live"}</span>
            </span>
            <div className="top-avatar" role="img" aria-label="Maria Lopez, lab administrator" title="Maria Lopez · Lab administrator">ML</div>
          </div>
        </header>

        <div className="page-content" id="cases" tabIndex={-1}>
          <div className="page-heading">
            <div className="heading-copy">
              <div className="eyebrow">
                Lab operations{todayDate && <><span aria-hidden="true">·</span>{formatDateOnly(todayDate)}</>}
              </div>
              <h1>Cases</h1>
              <p>Manage clinic deadlines at a glance</p>
            </div>
            <button type="button" className="primary-button" onClick={() => setIsNewCaseOpen(true)}>
              <Icon name="plus" size={18} /> New case
            </button>
          </div>

          {timeline ? <DueTimeline data={timeline} /> : isLoading ? <TimelineSkeleton /> : null}

          {dataMode === "demo" && (
            <div className="demo-banner" role="note">
              <span className="demo-banner-icon"><Icon name="alert" size={18} /></span>
              <div className="demo-banner-copy">
                <strong>Demo mode is on</strong>
                <span>Sample data is stored in this browser. Notifications open a preview and are never delivered.</span>
              </div>
              <button type="button" className="banner-button" onClick={resetDemoData}>
                <Icon name="refresh" size={16} /> Reset sample data
              </button>
            </div>
          )}

          <section className="overview-deck" aria-label="Case summary" aria-busy={isLoading}>
            <ReadinessGauge counts={counts} />
            <div className="metrics-grid">
              <Metric label="Total cases" value={counts.total} detail="Across all clinics" icon="calendar" tone="sage" total={counts.total} />
              <Metric label="In progress" value={counts.progress} detail="Currently in production" icon="clock" tone="blue" total={counts.total} />
              <Metric label="Ready for clinic" value={counts.ready} detail="Awaiting collection" icon="check" tone="green" total={counts.total} />
              <Metric label="Overdue" value={counts.overdue} detail="Past due · any status" icon="alert" tone="amber" total={counts.total} />
            </div>
          </section>

          {/* The case list is the operator's primary surface: it renders before
              the schedule pulse so production work is reachable without
              scrolling past analytics on a desktop viewport. */}
          <section className="cases-panel" aria-labelledby="cases-title" aria-busy={isLoading}>
            <div className="panel-head">
              <div>
                <span className="card-kicker">Production floor</span>
                <h2 id="cases-title">All cases</h2>
                <p>Review status, deadlines and clinic updates.</p>
              </div>
              <span className="panel-count"><strong>{visibleCases.length}</strong><span>of {cases.length}</span></span>
            </div>

            <div className="toolbar">
              <div className="search-box">
                <Icon name="search" size={18} />
                <input
                  ref={searchRef}
                  aria-label="Search cases"
                  placeholder="Search case, clinic or type…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <kbd aria-hidden="true">Ctrl K</kbd>
              </div>
              <div className="filter-chips" role="group" aria-label="Filter by status">
                {filters.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    className={`filter-chip${filter === entry.value ? " is-active" : ""}`}
                    aria-pressed={filter === entry.value}
                    onClick={() => setFilter(entry.value)}
                  >
                    {entry.label}
                    <span className="chip-count">{entry.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {notice && (
              <div className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-atomic="true">
                <span className="notice-icon">
                  {notice.kind === "success" ? <Icon name="check" size={17} /> : notice.kind === "error" ? <Icon name="alert" size={17} /> : <Icon name="mail" size={17} />}
                </span>
                <p>{notice.text}</p>
                <button type="button" className="notice-close" aria-label="Dismiss message" onClick={() => setNotice(null)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            )}

            {isLoading ? (
              <CaseSkeletons />
            ) : visibleCases.length === 0 ? (
              <EmptyState
                hasCases={cases.length > 0}
                onClear={clearFilters}
                onCreate={() => setIsNewCaseOpen(true)}
              />
            ) : (
              <>
                <div className="table-wrap">
                  <table className="case-table">
                    <caption className="sr-only">Cases with clinic, due date, status and notification actions</caption>
                    <thead>
                      <tr>
                        <th scope="col">Case / type</th>
                        <th scope="col">Clinic</th>
                        <th scope="col">Due date</th>
                        <th scope="col">Status</th>
                        <th scope="col">Notification</th>
                        <th scope="col"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCases.map(({ item, display }) => (
                        <tr key={item.id}>
                          <td>
                            <div className="case-cell">
                              <span className="case-avatar" aria-hidden="true">{caseTag(item.caseType)}</span>
                              <div className="case-copy">
                                <strong className="case-ref">{item.reference}</strong>
                                <span className="case-type">{item.caseType}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clinic-cell">
                              <strong>{item.clinicName}</strong>
                              <span>{item.clinicEmail}</span>
                            </div>
                          </td>
                          <td>
                            <div className={`due-cell${display.overdue ? " is-overdue" : ""}`}>
                              <span className="due-date"><Icon name="calendar" size={15} /><time dateTime={item.dueDate}>{formatDateOnly(item.dueDate)}</time></span>
                              {display.overdue && <span className="due-caption">Past due</span>}
                            </div>
                          </td>
                          <td>
                            <div className="status-stack">
                              <StatusPill display={display} />
                              <DeadlineBadge display={display} />
                            </div>
                          </td>
                          <td><NotificationLabel status={item.notificationStatus} /></td>
                          <td>
                            <div className="row-actions">
                              <RowActions item={item} busy={busyId === item.id} onReady={() => void markReady(item)} onNotify={() => void notifyClinic(item)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="case-cards">
                  {visibleCases.map(({ item, display }) => (
                    <article className="case-card" key={item.id}>
                      <div className="case-card-top">
                        <div className="case-cell">
                          <span className="case-avatar" aria-hidden="true">{caseTag(item.caseType)}</span>
                          <div className="case-copy">
                            <strong className="case-ref">{item.reference}</strong>
                            <span className="case-type">{item.caseType}</span>
                          </div>
                        </div>
                        <div className="status-stack">
                          <StatusPill display={display} />
                          <DeadlineBadge display={display} />
                        </div>
                      </div>
                      <div className="case-card-clinic">
                        <span className="meta-label">Clinic</span>
                        <strong>{item.clinicName}</strong>
                        <span>{item.clinicEmail}</span>
                      </div>
                      <div className="case-card-meta">
                        <div className={`due-cell${display.overdue ? " is-overdue" : ""}`}>
                          <span className="meta-label">Due</span>
                          <span className="due-date"><Icon name="calendar" size={15} /><time dateTime={item.dueDate}>{formatDateOnly(item.dueDate)}</time></span>
                          {display.overdue && <span className="due-caption">Past due</span>}
                        </div>
                        <div className="notification-cell">
                          <span className="meta-label">Notification</span>
                          <NotificationLabel status={item.notificationStatus} />
                        </div>
                      </div>
                      <div className="case-card-actions">
                        <RowActions item={item} busy={busyId === item.id} onReady={() => void markReady(item)} onNotify={() => void notifyClinic(item)} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            <div className="table-foot">
              <span>Showing <strong>{visibleCases.length}</strong> of <strong>{cases.length}</strong> cases</span>
              <span className="foot-note" title={`Overdue status is calculated using ${labTimeZone}`}>
                <Icon name="calendar" size={14} /> Calendar dates · {labTimeZone}
              </span>
            </div>
          </section>

          <footer className="page-footer">
            <span>© 2026 LabTrack · Dental lab operations</span>
            <span>Synthetic demo data · emails preview only</span>
          </footer>
        </div>
      </main>

      {preview && (
        <Dialog labelledBy="email-preview-title" onClose={closePreview} returnFocus={previewTriggerRef.current}>
          <div className="modal-top">
            <div className="modal-icon"><Icon name="mail" size={22} /></div>
            <button type="button" className="icon-button" onClick={closePreview} aria-label="Close email preview"><Icon name="close" size={20} /></button>
          </div>
          <div className="modal-heading">
            <span className={`mode-chip ${emailMode === "test" ? "chip-test" : "chip-live"}`}>
              {emailMode === "test" ? <><Icon name="alert" size={13} /> Test mode · not sent</> : <><Icon name="check" size={13} /> Live email accepted</>}
            </span>
            <h2 id="email-preview-title">Clinic notification</h2>
            <p>Review the message generated for {preview.to}.</p>
          </div>
          <dl className="email-fields">
            <div><dt>To</dt><dd>{preview.to}</dd></div>
            <div><dt>Subject</dt><dd>{preview.subject}</dd></div>
            <div className="email-body"><dt>Message</dt><dd><pre>{preview.text}</pre></dd></div>
          </dl>
          {emailMode === "test" && (
            <div className="test-warning"><Icon name="alert" size={17} /><span>This is only a preview. No email was delivered to the clinic.</span></div>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => void copyPreview()}>
              <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy message"}
            </button>
            <button type="button" className="primary-button" onClick={closePreview}>Done</button>
          </div>
        </Dialog>
      )}

      {isNewCaseOpen && (
        <Dialog labelledBy="new-case-title" onClose={closeNewCase}>
          <div className="modal-top">
            <div className="modal-icon"><Icon name="plus" size={22} /></div>
            <button type="button" className="icon-button" onClick={closeNewCase} aria-label="Close new case form"><Icon name="close" size={20} /></button>
          </div>
          <div className="modal-heading">
            <span className="card-kicker">New work</span>
            <h2 id="new-case-title">Create a case</h2>
            <p>Add a synthetic demo case to the current dashboard.</p>
          </div>
          <form className="new-case-form" onSubmit={(event) => void createCase(event)}>
            <label>
              Clinic name
              <input required autoComplete="organization" value={newCase.clinicName} onChange={(event) => setNewCase((old) => ({ ...old, clinicName: event.target.value }))} placeholder="e.g. Westside Dental" />
            </label>
            <label>
              Clinic email
              <input required type="email" autoComplete="email" value={newCase.clinicEmail} onChange={(event) => setNewCase((old) => ({ ...old, clinicEmail: event.target.value }))} placeholder="clinic@example.com" />
            </label>
            <label>
              Case type
              <span className="select-wrap">
                <select value={newCase.caseType} onChange={(event) => setNewCase((old) => ({ ...old, caseType: event.target.value }))}>
                  <option>Zirconia crown</option>
                  <option>Ceramic crown</option>
                  <option>Bridge · 3-unit</option>
                  <option>Implant crown</option>
                  <option>Night guard</option>
                  <option>Aligner</option>
                </select>
                <Icon name="chevron" size={16} />
              </span>
            </label>
            <label>
              Due date
              <input required type="date" value={newCase.dueDate} onChange={(event) => setNewCase((old) => ({ ...old, dueDate: event.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeNewCase}>Cancel</button>
              <button className="primary-button" type="submit">Create case <Icon name="arrow" size={16} /></button>
            </div>
            <p className="form-note">In demo mode, new cases are saved to this browser only. Database mode requires the Supabase setup in the README.</p>
          </form>
        </Dialog>
      )}
    </div>
  );
}

function ReadinessGauge({ counts }: { counts: Counts }) {
  const percentage = counts.total === 0 ? 0 : Math.round((counts.ready / counts.total) * 100);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percentage / 100);
  const ticks = Array.from({ length: 40 }, (_, index) => {
    const angle = ((index * 9 - 90) * Math.PI) / 180;
    // Node and Chromium can disagree by one ULP on trig results; rounding keeps
    // the server markup and client render byte-identical during hydration.
    const coord = (value: number) => Math.round(value * 100) / 100;
    return {
      x1: coord(90 + Math.cos(angle) * 74),
      y1: coord(90 + Math.sin(angle) * 74),
      x2: coord(90 + Math.cos(angle) * 79),
      y2: coord(90 + Math.sin(angle) * 79),
      active: index < Math.round((percentage / 100) * 40),
    };
  });
  const caseWord = counts.total === 1 ? "case" : "cases";

  return (
    <article className="readiness-card">
      <div className="card-heading">
        <div>
          <span className="card-kicker">At a glance</span>
          <h2>Clinic readiness</h2>
        </div>
        <span className="soft-badge">{counts.total} {caseWord}</span>
      </div>
      <div
        className="gauge"
        role="img"
        aria-label={`${percentage} percent ready for clinic: ${counts.ready} of ${counts.total} ${caseWord}. The ready share of all cases; in-progress and overdue counts are shown in the metric cards beside this gauge.`}
      >
        <svg viewBox="0 0 180 180" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="readiness-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2b8b77" />
              <stop offset="100%" stopColor="#175a4e" />
            </linearGradient>
          </defs>
          <g className="gauge-ticks">
            {ticks.map((tick, index) => (
              <line key={index} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} className={tick.active ? "is-active" : undefined} />
            ))}
          </g>
          <circle className="gauge-track" cx="90" cy="90" r={radius} />
          {/* CSS drives this stroke: the server markup and the hydration render
              are byte-identical, then the offset transitions when data lands. */}
          <circle
            className="gauge-progress"
            cx="90"
            cy="90"
            r={radius}
            transform="rotate(-90 90 90)"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>
        <div className="gauge-center" aria-hidden="true">
          <strong>{percentage}<span>%</span></strong>
          <span>ready</span>
        </div>
      </div>
      {/* The legend was removed: it repeated the exact counts the metric cards
          beside this gauge already show, doubling vertical space for no new
          information. The ratio itself (ready of all cases) stays in the
          gauge's accessible label and centre readout. */}
    </article>
  );
}

function Metric({ label, value, detail, icon, tone, total }: { label: string; value: number; detail: string; icon: IconName; tone: string; total: number }) {
  const share = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon"><Icon name={icon} size={18} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-meta">
        <span>{detail}</span>
        <span className="metric-share">{share}%</span>
      </div>
      <div className="metric-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
    </article>
  );
}

function DueTimeline({ data }: { data: TimelineData }) {
  return (
    <section className="timeline-card" aria-labelledby="timeline-title">
      <div className="timeline-head">
        <div>
          <span className="card-kicker">Schedule</span>
          <h2 id="timeline-title">Due-date pulse</h2>
          <p>{formatRange(data.first, data.last)} <span aria-hidden="true">·</span> Today is {formatDateOnly(data.todayKey)}</p>
        </div>
        <ul className="timeline-legend" aria-label="Status key">
          <li><span className="legend-mark mark-ready" aria-hidden="true" />Ready</li>
          <li><span className="legend-mark mark-progress" aria-hidden="true" />In progress</li>
          <li><span className="legend-mark mark-overdue" aria-hidden="true" />Overdue</li>
          <li><span className="legend-mark mark-today" aria-hidden="true" />Due today</li>
        </ul>
      </div>
      <ol className="timeline-days" aria-label={`Case due dates from ${formatDateOnly(data.first)} to ${formatDateOnly(data.last)}`}>
        {data.days.map((day) => {
          const summary = day.entries.length === 0
            ? "no cases due"
            : day.entries.map(({ item, display }) => `${item.reference} for ${item.clinicName}, ${display.status === "READY" ? "ready" : "in progress"}${display.deadline === "overdue" ? ", overdue" : display.deadline === "today" ? ", due today" : ""}`).join("; ");
          return (
            <li
              key={day.key}
              className={`timeline-day${day.isToday ? " is-today" : ""}${day.isPast ? " is-past" : ""}`}
              aria-current={day.isToday ? "date" : undefined}
            >
              <span className="sr-only">{day.isToday ? "Today, " : ""}{day.label}: {summary}.</span>
              <span className="timeline-weekday" aria-hidden="true">{day.weekday}</span>
              <time className="timeline-number" dateTime={day.key} aria-hidden="true">{day.dayNumber}</time>
              <span className="timeline-markers" aria-hidden="true">
                {day.entries.slice(0, 3).map(({ item, display }) => (
                  <span
                    key={item.id}
                    className={`timeline-dot ${timelineDotClass(display)}`}
                    title={`${item.reference} · ${item.clinicName} · ${display.status === "READY" ? "Ready" : "In progress"}${display.deadline === "overdue" ? " · Overdue" : display.deadline === "today" ? " · Due today" : ""}`}
                  />
                ))}
                {day.entries.length > 3 && <span className="timeline-more">+{day.entries.length - 3}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="timeline-note">{timelineNote(data)}</p>
    </section>
  );
}

function StatusPill({ display }: { display: ReturnType<typeof getDisplayStatus> }) {
  // Production status only; the deadline condition has its own badge so the
  // two never overwrite each other (previously an overdue case lost its real
  // status entirely because both shared one pill).
  const label = display.status === "READY" ? "Ready" : "In progress";
  const className = display.status === "READY" ? "status-ready" : "status-progress";
  return <span className={`status-pill ${className}`}><span className="status-dot" aria-hidden="true" />{label}</span>;
}

function DeadlineBadge({ display }: { display: ReturnType<typeof getDisplayStatus> }) {
  if (display.deadline === "overdue") {
    return <span className="deadline-badge deadline-overdue"><Icon name="alert" size={12} /> Overdue</span>;
  }
  if (display.deadline === "today") {
    return <span className="deadline-badge deadline-today"><Icon name="clock" size={12} /> Due today</span>;
  }
  return null;
}

function NotificationLabel({ status }: { status: LabCase["notificationStatus"] }) {
  if (status === "SENT") return <span className="notification-state notification-sent"><Icon name="check" size={14} /> Sent</span>;
  if (status === "PREVIEWED") return <span className="notification-state notification-preview"><Icon name="mail" size={14} /> Previewed</span>;
  if (status === "FAILED") return <span className="notification-state notification-failed"><Icon name="alert" size={14} /> Failed</span>;
  return <span className="notification-state notification-none"><span className="notification-dot" aria-hidden="true" /> Not sent</span>;
}

function RowActions({ item, busy, onReady, onNotify }: { item: LabCase; busy: boolean; onReady: () => void; onNotify: () => void }) {
  if (item.status !== "READY") {
    return (
      <button type="button" className="row-button" disabled={busy} aria-busy={busy} onClick={onReady}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={15} />}
        {busy ? "Saving…" : "Mark ready"}
      </button>
    );
  }
  if (item.notificationStatus === "SENT") {
    return (
      <button type="button" className="row-button is-done" disabled title="A live notification has already been sent">
        <Icon name="check" size={15} /> Sent
      </button>
    );
  }
  return (
    <button type="button" className="row-button is-primary" disabled={busy} aria-busy={busy} onClick={onNotify}>
      {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="mail" size={15} />}
      {busy ? "Preparing…" : "Notify"}
    </button>
  );
}

function EmptyState({ hasCases, onClear, onCreate }: { hasCases: boolean; onClear: () => void; onCreate: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="inbox" size={22} /></span>
      <strong>{hasCases ? "No cases match" : "No cases yet"}</strong>
      <p>{hasCases ? "Try a different search or clear the status filter." : "Create your first demo case to see it here."}</p>
      <button type="button" className="secondary-button" onClick={hasCases ? onClear : onCreate}>
        {hasCases ? "Clear filters" : "New case"}
      </button>
    </div>
  );
}

function CaseSkeletons() {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="sr-only">Loading cases…</span>
      <div className="skeleton-table" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-row" key={index}>
            <span className="skeleton-avatar" />
            <span className="skeleton-stack"><span className="skeleton-line w-70" /><span className="skeleton-line w-45" /></span>
            <span className="skeleton-stack"><span className="skeleton-line w-85" /><span className="skeleton-line w-55" /></span>
            <span className="skeleton-line w-65" />
            <span className="skeleton-pill" />
            <span className="skeleton-pill" />
          </div>
        ))}
      </div>
      <div className="case-cards skeleton-cards" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton-card-top">
              <span className="skeleton-avatar" />
              <span className="skeleton-stack"><span className="skeleton-line w-70" /><span className="skeleton-line w-45" /></span>
              <span className="skeleton-pill" />
            </div>
            <span className="skeleton-line w-85" />
            <span className="skeleton-line w-55" />
            <span className="skeleton-button" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <section className="timeline-card timeline-skeleton" aria-hidden="true">
      <div className="skeleton-line w-25 skeleton-title" />
      <div className="skeleton-line w-45" />
      <div className="skeleton-track">
        {Array.from({ length: 14 }, (_, index) => <span key={index} className="skeleton-tick" />)}
      </div>
    </section>
  );
}

function Dialog({ children, labelledBy, onClose, returnFocus }: { children: ReactNode; labelledBy: string; onClose: () => void; returnFocus?: HTMLElement | null }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previouslyFocused = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const panel = panelRef.current;
    const getFocusable = () => {
      if (!panel) return [] as HTMLElement[];
      return Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((node) => node.getClientRects().length > 0);
    };

    getFocusable()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = getFocusable();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose, returnFocus]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div
        ref={panelRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
