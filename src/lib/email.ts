import "server-only";
import nodemailer from "nodemailer";

/**
 * Envio de e-mail via SMTP genérico (Gmail, Resend, SES, Mailgun…).
 *
 * Variáveis: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS,
 * SMTP_FROM ("Cliente Oculto <no-reply@dominio>"). Sem SMTP_HOST o envio
 * vira no-op com log — o sistema funciona normalmente sem e-mail.
 */

function configurado(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let transporte: nodemailer.Transporter | null = null;

function transportador(): nodemailer.Transporter {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporte;
}

/** Envia e-mail em melhor-esforço: falha vira log, nunca derruba o fluxo. */
export async function enviarEmail(
  para: string[],
  assunto: string,
  html: string,
): Promise<boolean> {
  const destinatarios = [...new Set(para.filter(Boolean))];
  if (destinatarios.length === 0) return false;
  if (!configurado()) {
    console.log(
      `[email] SMTP não configurado — pulando "${assunto}" para ${destinatarios.join(", ")}`,
    );
    return false;
  }
  try {
    await transportador().sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: destinatarios.join(", "),
      subject: assunto,
      html,
    });
    console.log(`[email] enviado: "${assunto}" para ${destinatarios.length} destinatário(s)`);
    return true;
  } catch (e) {
    console.error(`[email] falha ao enviar "${assunto}":`, e);
    return false;
  }
}

export function rodapeEmail(baseUrl: string): string {
  return `<p style="color:#64748b;font-size:12px;margin-top:24px">
    Notificação automática do sistema Cliente Oculto —
    <a href="${baseUrl}" style="color:#2563eb">abrir o painel</a>.
  </p>`;
}
