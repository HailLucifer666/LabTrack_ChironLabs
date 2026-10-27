import type { LabCase, NotificationStatus } from "@/lib/types";

type DbCase = {
  id: string;
  reference: string;
  clinic_name: string;
  clinic_email: string;
  case_type: string;
  due_date: string;
  status: "IN_PROGRESS" | "READY";
  notification_status: NotificationStatus | null;
  updated_at: string;
};

export function fromDbCase(row: DbCase): LabCase {
  return {
    id: row.id,
    reference: row.reference,
    clinicName: row.clinic_name,
    clinicEmail: row.clinic_email,
    caseType: row.case_type,
    dueDate: row.due_date,
    status: row.status,
    notificationStatus: row.notification_status || "NOT_SENT",
    updatedAt: row.updated_at,
  };
}
