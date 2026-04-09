/**
 * Email notification helper for interview scheduling.
 * Uses the Manus built-in notification API to send emails to recruiters.
 */

import { ENV } from "./_core/env";

interface InterviewNotificationParams {
  recruiterEmail: string;
  recruiterName: string;
  candidateName: string;
  scheduledAt: number; // UTC ms
  location?: string;
  interviewerName?: string;
  notes?: string;
}

/**
 * Sends an interview scheduling notification email to the recruiter.
 * Uses the built-in Forge notification API.
 */
export async function sendInterviewNotification(params: InterviewNotificationParams): Promise<void> {
  const {
    recruiterEmail,
    recruiterName,
    candidateName,
    scheduledAt,
    location,
    interviewerName,
    notes,
  } = params;

  const scheduledDate = new Date(scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = scheduledDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const subject = `Interview Scheduled: ${candidateName} — ${formattedDate}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f8f6; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #1a1a1a; padding: 32px 40px; }
    .header h1 { color: #ffffff; font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.3px; }
    .header p { color: #999; font-size: 13px; margin: 4px 0 0; }
    .body { padding: 32px 40px; }
    .greeting { font-size: 15px; color: #333; margin-bottom: 20px; }
    .card { background: #f8f8f6; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; }
    .card-row { display: flex; margin-bottom: 12px; }
    .card-row:last-child { margin-bottom: 0; }
    .label { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; width: 120px; flex-shrink: 0; padding-top: 1px; }
    .value { font-size: 14px; color: #1a1a1a; font-weight: 500; }
    .footer { padding: 20px 40px; border-top: 1px solid #f0f0ee; }
    .footer p { font-size: 12px; color: #aaa; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Scheduled</h1>
      <p>Tanis HR Recruitment System</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${recruiterName},</p>
      <p style="font-size:14px;color:#555;margin-bottom:24px;">An interview has been scheduled. Here are the details:</p>
      <div class="card">
        <div class="card-row">
          <span class="label">Candidate</span>
          <span class="value">${candidateName}</span>
        </div>
        <div class="card-row">
          <span class="label">Date</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="card-row">
          <span class="label">Time</span>
          <span class="value">${formattedTime}</span>
        </div>
        ${location ? `<div class="card-row"><span class="label">Location</span><span class="value">${location}</span></div>` : ""}
        ${interviewerName ? `<div class="card-row"><span class="label">Interviewer</span><span class="value">${interviewerName}</span></div>` : ""}
        ${notes ? `<div class="card-row"><span class="label">Notes</span><span class="value">${notes}</span></div>` : ""}
      </div>
      <p style="font-size:13px;color:#888;">Please log in to the Tanis HR system to view the full candidate profile and manage the interview.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Tanis HR Recruitment System.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
Interview Scheduled — Tanis HR

Hi ${recruiterName},

An interview has been scheduled with the following details:

Candidate: ${candidateName}
Date: ${formattedDate}
Time: ${formattedTime}
${location ? `Location: ${location}\n` : ""}${interviewerName ? `Interviewer: ${interviewerName}\n` : ""}${notes ? `Notes: ${notes}\n` : ""}

Log in to the Tanis HR system to view the full candidate profile.

— Tanis HR Recruitment System
  `.trim();

  // Use Manus built-in Forge API for email delivery
  const apiUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!apiUrl || !apiKey) {
    console.warn("[Email] Forge API credentials not available, skipping email notification.");
    return;
  }

  const response = await fetch(`${apiUrl}/v1/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: recruiterEmail,
      subject,
      html: htmlBody,
      text: textBody,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Email] Failed to send notification: ${response.status} ${body}`);
    throw new Error(`Email send failed: ${response.status}`);
  }
}
