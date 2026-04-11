import { getResend, FROM } from "./resend";
import { formatCurrency } from "@/lib/constants";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Levy Notice ───────────────────────────────────────────────

export interface LevyNoticeData {
  recipientName: string;
  buildingName: string;
  unitNumber: string;
  levyType: string;
  amountCents: number;
  dueDate: Date;
}

export async function sendLevyNoticeEmail(
  to: string,
  data: LevyNoticeData
): Promise<void> {
  const levyLabels: Record<string, string> = {
    ADMIN_FUND: "Admin Fund",
    CAPITAL_WORKS: "Capital Works",
    SPECIAL_LEVY: "Special Levy",
  };
  const label = levyLabels[data.levyType] ?? data.levyType;
  const amount = formatCurrency(data.amountCents);
  const due = data.dueDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `New Strata Levy — ${label} for Unit ${data.unitNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#1e3a5f">StrataHub — Levy Notice</h2>
          <p>Dear ${esc(data.recipientName)},</p>
          <p>A new strata levy has been raised for your unit at <strong>${esc(data.buildingName)}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Unit</td><td style="padding:8px;border:1px solid #e2e8f0">${esc(data.unitNumber)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Levy Type</td><td style="padding:8px;border:1px solid #e2e8f0">${esc(label)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Amount</td><td style="padding:8px;border:1px solid #e2e8f0">${amount}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Due Date</td><td style="padding:8px;border:1px solid #e2e8f0">${due}</td></tr>
          </table>
          <p>Please arrange payment by the due date. Contact your building manager if you have any questions.</p>
          <p style="color:#64748b;font-size:12px;margin-top:32px">StrataHub — Australian Property Management</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[email] sendLevyNoticeEmail failed:", err);
  }
}

// ── Maintenance Update ────────────────────────────────────────

export interface MaintenanceUpdateData {
  recipientName: string;
  buildingName: string;
  unitNumber: string;
  requestTitle: string;
  newStatus: string;
}

export async function sendMaintenanceUpdateEmail(
  to: string,
  data: MaintenanceUpdateData
): Promise<void> {
  const statusLabels: Record<string, string> = {
    SUBMITTED: "Submitted",
    ACKNOWLEDGED: "Acknowledged",
    IN_PROGRESS: "In Progress",
    AWAITING_PARTS: "Awaiting Parts",
    SCHEDULED: "Scheduled",
    COMPLETED: "Completed",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  };
  const statusLabel = statusLabels[data.newStatus] ?? data.newStatus;

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Maintenance Update — ${data.requestTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#1e3a5f">StrataHub — Maintenance Update</h2>
          <p>Dear ${esc(data.recipientName)},</p>
          <p>Your maintenance request at <strong>${esc(data.buildingName)}</strong> has been updated.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Request</td><td style="padding:8px;border:1px solid #e2e8f0">${esc(data.requestTitle)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Unit</td><td style="padding:8px;border:1px solid #e2e8f0">${esc(data.unitNumber)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">New Status</td><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#2563eb">${esc(statusLabel)}</td></tr>
          </table>
          <p>Log in to StrataHub to view full details or add a comment.</p>
          <p style="color:#64748b;font-size:12px;margin-top:32px">StrataHub — Australian Property Management</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[email] sendMaintenanceUpdateEmail failed:", err);
  }
}

// ── Welcome / Invite ──────────────────────────────────────────

export interface WelcomeInviteData {
  organisationName: string;
  buildingName?: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

export async function sendWelcomeInviteEmail(
  to: string,
  data: WelcomeInviteData
): Promise<void> {
  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    BUILDING_MANAGER: "Building Manager",
    RECEPTION: "Reception",
    OWNER: "Owner",
    TENANT: "Tenant",
  };
  const roleLabel = roleLabels[data.role] ?? data.role;
  const expires = data.expiresAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `You've been invited to ${data.organisationName} on StrataHub`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#1e3a5f">Welcome to StrataHub</h2>
          <p>You've been invited to join <strong>${esc(data.organisationName)}</strong>${data.buildingName ? ` (${esc(data.buildingName)})` : ""} as a <strong>${esc(roleLabel)}</strong>.</p>
          <p>Click the button below to accept your invitation and set up your account. This link expires on ${esc(expires)}.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${encodeURI(data.inviteUrl)}" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Accept Invitation</a>
          </div>
          <p style="color:#64748b;font-size:13px">If you were not expecting this invitation, you can ignore this email.</p>
          <p style="color:#64748b;font-size:12px;margin-top:32px">StrataHub — Australian Property Management</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[email] sendWelcomeInviteEmail failed:", err);
  }
}
