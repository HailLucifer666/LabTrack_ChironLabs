export type CaseStatus = "IN_PROGRESS" | "READY";
export type NotificationStatus = "NOT_SENT" | "PREVIEWED" | "SENT" | "FAILED";

export interface LabCase {
  id: string;
  reference: string;
  clinicName: string;
  clinicEmail: string;
  caseType: string;
  dueDate: string; // Date-only ISO value: YYYY-MM-DD. Never serialize as a UTC timestamp.
  status: CaseStatus;
  notificationStatus: NotificationStatus;
  updatedAt: string;
}

export interface CaseListResponse {
  cases: LabCase[];
  todayDate: string;
  dataMode: "database" | "demo";
  labTimeZone: string;
}

export interface EmailPreview {
  to: string;
  subject: string;
  text: string;
  html: string;
}
