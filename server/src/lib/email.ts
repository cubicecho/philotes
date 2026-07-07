import nodemailer from 'nodemailer';

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }

  // Dev fallback — log emails to the console instead of sending them
  return nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
}

const transport = createTransport();
const FROM = process.env.EMAIL_FROM ?? 'Philotes <noreply@philotes.app>';

export async function sendMagicLinkEmail(to: string, magicLink: string): Promise<void> {
  const info = await transport.sendMail({
    from: FROM,
    to,
    subject: 'Your Philotes sign-in link',
    text: `Click this link to sign in to Philotes (expires in 15 minutes):\n\n${magicLink}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <p>Click the button below to sign in to Philotes. This link expires in 15 minutes.</p>
      <p style="margin:24px 0">
        <a href="${magicLink}" style="background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Sign in to Philotes
        </a>
      </p>
      <p style="color:#71717a;font-size:13px">
        Or copy this URL into your browser:<br>${magicLink}
      </p>
      <p style="color:#71717a;font-size:13px">If you did not request this, you can safely ignore this email.</p>
    `,
  });

  // In dev (stream transport) print the link so it's usable without an email server
  if (!process.env.SMTP_HOST) {
    console.log('\n──────────────────────────────────────────');
    console.log('📧  Magic link for', to);
    console.log(magicLink);
    console.log('──────────────────────────────────────────\n');
    if ('message' in info && info.message) {
      // biome-ignore lint/suspicious/noExplicitAny: nodemailer stream type
      (info as any).message.resume();
    }
  }
}
