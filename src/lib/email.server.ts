// Server-only email helper. Uses Lovable Email API if available; falls back to console log.
export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: boolean; devCode?: string; reason?: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const from = process.env.EMAIL_FROM || "Ashish Cloud <notify@ashish.cloud>";
  if (apiKey) {
    try {
      const res = await fetch("https://email.lovable.dev/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[email] Lovable Email send failed: ${res.status} ${body}`);
        console.log(`[email DEV-FALLBACK] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text ?? opts.html}`);
        return { ok: false, reason: `Email provider returned ${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      console.error("[email] send error", e);
      console.log(`[email DEV-FALLBACK] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text ?? opts.html}`);
      return { ok: false, reason: "Email transport error" };
    }
  }
  // Dev mode: log to server console.
  console.log(`[email DEV] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text ?? opts.html}`);
  return { ok: true };
}

export function otpEmailHtml(code: string): { subject: string; html: string; text: string } {
  return {
    subject: `Ashish Cloud — Admin login code: ${code}`,
    text: `Your Ashish Cloud admin login code is: ${code}\nIt expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0f172a;border-radius:16px">
      <h2 style="margin:0 0 8px;font-weight:700">Ashish Cloud</h2>
      <p style="color:#475569;margin:0 0 24px">Admin verification code</p>
      <div style="font-size:36px;letter-spacing:0.4em;font-weight:700;padding:20px;background:#f1f5f9;border-radius:12px;text-align:center">${code}</div>
      <p style="color:#64748b;font-size:13px;margin-top:24px">This code expires in 10 minutes. If you didn't request it, your account is still safe — ignore this email.</p>
    </div>`,
  };
}

export function inviteEmailHtml(url: string, role: string): { subject: string; html: string; text: string } {
  return {
    subject: `You're invited to Ashish Cloud`,
    text: `You've been invited to Ashish Cloud as ${role}. Accept here: ${url}`,
    html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;color:#0f172a;border-radius:16px">
      <h2 style="margin:0 0 8px;font-weight:700">Ashish Cloud</h2>
      <p style="color:#475569;margin:0 0 24px">You've been invited to join as <strong>${role}</strong>.</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Accept invitation</a>
      <p style="color:#64748b;font-size:13px;margin-top:24px">Or paste this link in your browser:<br><span style="word-break:break-all">${url}</span></p>
    </div>`,
  };
}
