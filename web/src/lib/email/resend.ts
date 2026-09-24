import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.RESEND_FROM_EMAIL || "QuantBreadth <security@quantbreadth.com>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Base email layout matching QuantBreadth™ institutional terminal aesthetic.
 */
function baseTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #070b14;
      color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 580px;
      margin: 40px auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 28px 32px;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
    }
    .badge {
      display: inline-block;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #06b6d4, #4f46e5);
      border-radius: 8px;
      text-align: center;
      line-height: 32px;
      font-weight: 900;
      font-size: 14px;
      color: #ffffff;
      margin-right: 12px;
      vertical-align: middle;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #f1f5f9;
      letter-spacing: -0.5px;
      vertical-align: middle;
      display: inline-block;
    }
    .brand-highlight {
      color: #22d3ee;
    }
    .brand-pro {
      font-size: 10px;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      background-color: #312e81;
      color: #a5b4fc;
      border: 1px solid #4338ca;
      font-weight: bold;
      margin-left: 6px;
      vertical-align: middle;
    }
    .content {
      padding: 36px 32px;
      color: #cbd5e1;
      font-size: 15px;
      line-height: 1.65;
    }
    .button-container {
      margin: 32px 0;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
    }
    .callout {
      background-color: rgba(30, 41, 59, 0.5);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 14px 18px;
      margin-top: 24px;
      font-size: 13px;
      color: #94a3b8;
    }
    .footer {
      padding: 24px 32px;
      background-color: #090e1a;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
    .footer a {
      color: #38bdf8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="badge">QB</span>
      <span class="brand-title">QuantBreadth<span class="brand-highlight">™</span></span>
      <span class="brand-pro">SECURITY</span>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      This is an automated institutional security notification from QuantBreadth™ Terminal.<br>
      © ${new Date().getFullYear()} QuantBreadth Systems. All rights reserved.
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send Email Verification link via Resend.
 */
export async function sendEmailVerification({
  email,
  name,
  url,
}: {
  email: string;
  name?: string;
  url: string;
}): Promise<{ success: boolean; error?: string }> {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const html = baseTemplate(
    "Verify your QuantBreadth™ Terminal Account",
    `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px; font-weight: 700;">Confirm your email address</h2>
      <p>${greeting}</p>
      <p>Thank you for creating an account with <strong>QuantBreadth™ Institutional Market Breadth Terminal</strong>. Please confirm your email address to activate your terminal session and verify your access entitlements.</p>
      
      <div class="button-container">
        <a href="${url}" class="cta-button" target="_blank">Verify Email Address</a>
      </div>

      <div class="callout">
        <strong>Security Notice:</strong> This verification link is valid for 24 hours. If you did not request this account, please ignore this email or contact security.
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px; word-break: break-all;">
        If the button above does not work, paste this URL into your browser:<br>
        <a href="${url}" style="color: #38bdf8;">${url}</a>
      </p>
    `
  );

  if (!resend) {
    console.warn(
      `[Resend Email Mock] RESEND_API_KEY is not configured. Email verification would have been sent to: ${email}`
    );
    console.warn(`[Resend Email Mock] Verification Link: ${url}`);
    return { success: true };
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your QuantBreadth™ Terminal Account",
      html,
    });
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Email dispatch failed";
    console.error("[Resend Error] Failed to send verification email:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send Password Reset link via Resend.
 */
export async function sendPasswordResetEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<{ success: boolean; error?: string }> {
  const html = baseTemplate(
    "Reset your QuantBreadth™ Terminal Password",
    `
      <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px; font-weight: 700;">Password Reset Request</h2>
      <p>We received a request to reset the password for your QuantBreadth™ terminal access associated with <strong>${email}</strong>.</p>
      
      <div class="button-container">
        <a href="${url}" class="cta-button" target="_blank">Reset Terminal Password</a>
      </div>

      <div class="callout">
        <strong>Important:</strong> This password reset link will expire in 60 minutes. If you did not initiate this request, someone may be attempting to access your account. Please secure your account immediately.
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px; word-break: break-all;">
        Direct URL:<br>
        <a href="${url}" style="color: #38bdf8;">${url}</a>
      </p>
    `
  );

  if (!resend) {
    console.warn(
      `[Resend Email Mock] RESEND_API_KEY is not configured. Password reset email would have been sent to: ${email}`
    );
    console.warn(`[Resend Email Mock] Reset Link: ${url}`);
    return { success: true };
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your QuantBreadth™ Terminal Password",
      html,
    });
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Email dispatch failed";
    console.error("[Resend Error] Failed to send password reset email:", err);
    return { success: false, error: errorMsg };
  }
}
