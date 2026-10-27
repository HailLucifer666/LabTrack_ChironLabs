import type { LabCase } from "@/lib/types";

export type NotifyReason = "demo-workspace" | "provider-not-configured" | "synthetic-recipient";

export type NotifyAction =
  | { action: "send"; recipient: string }
  | { action: "preview"; reason: NotifyReason };

export interface NotifyConfig {
  /** True when the case came from the server-owned database, not the browser's demo state. */
  databaseConfigured: boolean;
  /** True when RESEND_API_KEY and EMAIL_FROM are both present on the server. */
  providerConfigured: boolean;
}

/**
 * Recipients in reserved domains (RFC 2606 / RFC 6761) are placeholders, never
 * a valid live delivery target: example.com/.net/.org plus the .test, .invalid,
 * .localhost and .example TLDs. Anchored at the end so `clinic@example.com.evil.io`
 * is still treated as a real address.
 */
const RESERVED_RECIPIENT =
  /@(?:example\.(?:com|net|org)|(?:[a-z0-9-]+\.)+(?:test|invalid|localhost|example))$/i;

export function isSyntheticRecipient(email: string): boolean {
  return RESERVED_RECIPIENT.test(email.trim());
}

/**
 * The single rule deciding whether a notification may leave the building.
 *
 * A live send requires all three, in this order, and each gate is independent:
 *   1. the case came from the server's database — demo state is client-editable,
 *      so a demo workspace must never be able to address a real mailbox even
 *      when email credentials are configured;
 *   2. the email provider is configured;
 *   3. the recipient is not a reserved placeholder address.
 *
 * This used to hang on gate 3 alone, so adding RESEND_API_KEY while still in
 * demo mode turned client-supplied addresses into real sends.
 */
export function decideNotification(
  item: Pick<LabCase, "clinicEmail">,
  config: NotifyConfig,
): NotifyAction {
  if (!config.databaseConfigured) return { action: "preview", reason: "demo-workspace" };
  if (!config.providerConfigured) return { action: "preview", reason: "provider-not-configured" };
  if (isSyntheticRecipient(item.clinicEmail)) return { action: "preview", reason: "synthetic-recipient" };
  return { action: "send", recipient: item.clinicEmail };
}

export function previewNotice(reason: NotifyReason): string {
  if (reason === "demo-workspace") {
    return "TEST MODE — no email was delivered. Demo workspaces never send real email.";
  }
  if (reason === "synthetic-recipient") {
    return "TEST MODE — sample recipient is reserved and no email was delivered.";
  }
  return "TEST MODE — no email was delivered.";
}
