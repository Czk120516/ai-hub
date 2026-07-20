/**
 * 网易 163 SMTP 邮件发送
 */
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.163.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const OTP_EXPIRE_MINUTES = 5;
const FROM_NAME = process.env.FROM_NAME || "AI Hub";
const FROM_EMAIL = process.env.SMTP_USER;

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: `AI Hub 验证码：${code}`,
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <div style="background:#4f46e5;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="margin:0;font-size:22px">AI Hub</h1>
        </div>
        <div style="background:#fff;padding:32px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <p style="margin:0 0 12px;color:#475569;font-size:15px">您的验证码是：</p>
          <div style="background:#f1f5f9;padding:16px;border-radius:8px;text-align:center;margin-bottom:16px">
            <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e293b">${code}</span>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:13px">验证码 ${OTP_EXPIRE_MINUTES} 分钟内有效，请勿转发给他人。</p>
        </div>
      </div>
    `,
  });
}
