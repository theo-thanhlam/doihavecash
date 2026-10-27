import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendOtpEmail(to: string, code: string) {
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? "DoIHaveMoney <no-reply@doihavemoney.local>",
    to,
    subject: `Your DoIHaveMoney code: ${code}`,
    text: `Your sign-in code is ${code}. It expires in 5 minutes. If you didn't ask for it, ignore this email.`,
  });
}
