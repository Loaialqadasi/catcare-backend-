import nodemailer from 'nodemailer';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Create a nodemailer transporter using the configured SMTP settings.
 *
 * UTM uses Microsoft 365 / Exchange Online for email. The recommended
 * SMTP settings are:
 *   SMTP_HOST  = smtp.office365.com
 *   SMTP_PORT  = 587  (STARTTLS)
 *   SMTP_USER  = your-utm-email@utm.my
 *   SMTP_PASS  = your-utm-password (or app password if MFA is enabled)
 *
 * Office 365 uses STARTTLS on port 587 (not implicit TLS on 465).
 * We set `secure: false` and `requireTLS: true` to enforce STARTTLS.
 */
function createTransporter() {
  const port = env.SMTP_PORT ?? 587;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    // Office 365 / Outlook uses STARTTLS on port 587, NOT implicit TLS on 465
    // secure:true = implicit TLS (port 465), secure:false + requireTLS = STARTTLS (port 587)
    secure: port === 465,
    requireTLS: true, // Force STARTTLS upgrade on port 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    // Office 365 sometimes needs a longer connection timeout
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const fromAddress = () => env.SMTP_FROM ?? `"CatCare UTM" <${env.SMTP_USER}>`;

/**
 * Send a password reset email to the user.
 *
 * If SMTP environment variables are not configured, the reset URL is logged
 * to the console instead. This is the development/test fallback.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    // Development fallback: log the reset URL so testers can use it
    logger.info({ to, resetUrl }, 'Password reset email (SMTP not configured — URL logged)');
    return;
  }

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: 'CatCare UTM — Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b, #ea580c); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">CatCare UTM</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Campus Cat Welfare System</p>
          </div>
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937;">Password Reset Request</h2>
            <p style="color: #4b5563;">You requested a password reset for your CatCare UTM account.</p>
            <p style="color: #4b5563;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}"
                 style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              If you did not request this, you can safely ignore this email.
              The link will expire automatically.
            </p>
          </div>
        </div>
      `,
      text: `You requested a password reset for your CatCare UTM account.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    });

    logger.info({ to }, 'Password reset email sent successfully');
  } catch (error) {
    logger.error({ error, to }, 'Failed to send password reset email');
    // Don't throw — we don't want email sending failures to break the forgot-password flow
    // The user will see the success message either way (prevents email enumeration)
  }
}

/**
 * Send an email verification email to the user.
 *
 * If SMTP environment variables are not configured, the verification URL is logged
 * to the console instead.
 */
export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.info({ to, verificationUrl }, 'Email verification (SMTP not configured — URL logged)');
    return;
  }

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: 'CatCare UTM — Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b, #ea580c); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">CatCare UTM</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Campus Cat Welfare System</p>
          </div>
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937;">Welcome to CatCare UTM!</h2>
            <p style="color: #4b5563;">Please verify your email address to activate your account.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${verificationUrl}"
                 style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verify Email
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              This link expires in <strong>24 hours</strong>. If you did not create an account, you can ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `Please verify your email address for CatCare UTM.\n\nClick the link below (expires in 24 hours):\n${verificationUrl}\n\nIf you did not create an account, you can ignore this email.`,
    });

    logger.info({ to }, 'Verification email sent successfully');
  } catch (error) {
    logger.error({ error, to }, 'Failed to send verification email');
  }
}
