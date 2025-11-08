import { sendMail } from '../utils/mailer';

const to = process.env.TEST_RECEIVE_EMAIL;
const sendgridConfigured = Boolean(process.env.SENDGRID_API_KEY && to);

if (!sendgridConfigured) {
  test.skip('SendGrid not configured; set TEST_RECEIVE_EMAIL and SENDGRID_API_KEY to run this test', () => {
    // skipped
  });
} else {
  test('sends hello world email', async () => {
    const subject = 'Test: Hello World';
    const text = 'Hello world from integration test';
    const html = '<p>Hello world from <strong>integration test</strong></p>';

    const info = await sendMail({ to: to as string, subject, text, html });

    // nodemailer returns an info object with messageId (and accepted array for some transports)
    expect(info).toBeDefined();
    // prefer messageId, fall back to accepted array
    const ok = Boolean((info as any).messageId || (info as any).accepted);
    expect(ok).toBeTruthy();
  }, 20000);
}
