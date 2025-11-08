import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
const from =
  process.env.FROM_EMAIL || process.env.SENDGRID_FROM || 'no-reply@example.com';

if (!apiKey) {
  // Allow the app to start but make sendMail fail with a clear error when invoked.
  console.warn('SendGrid not configured. Set SENDGRID_API_KEY to send emails.');
} else {
  sgMail.setApiKey(apiKey);
}

export async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  if (!apiKey) {
    throw new Error(
      'SendGrid not configured. Set SENDGRID_API_KEY environment variable.'
    );
  }

  const msg = {
    to,
    from,
    subject,
    text,
    html,
  } as any;

  const resp = await sgMail.send(msg);
  // SendGrid returns an array of responses; for compatibility with previous
  // mailer behavior return a small object containing accepted recipients and
  // the raw SendGrid response.
  return { accepted: [to], sendgrid: resp } as any;
}
