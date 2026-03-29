import nodemailer from "nodemailer";
import { getConfig } from "./configService";

export interface EmailSendResult {
  sent: boolean;
  previewUrl?: string;
}

let _etherealAccount: { user: string; pass: string } | null = null;

async function getEtherealAccount() {
  if (!_etherealAccount) {
    const account = await nodemailer.createTestAccount();
    _etherealAccount = { user: account.user, pass: account.pass };
    console.log(`[Email] Ethereal account criada: ${account.user}`);
    console.log(`[Email] Acesse https://ethereal.email/login para ver os e-mails enviados`);
    console.log(`[Email] Login: ${account.user} / ${account.pass}`);
  }
  return _etherealAccount;
}

async function createTransporter(): Promise<{ transport: nodemailer.Transporter; isEthereal: boolean }> {
  const configUser = (await getConfig("MAIL_USER")) ?? process.env["MAIL_USER"];
  const configPass = (await getConfig("MAIL_PASS")) ?? process.env["MAIL_PASS"];

  if (!configUser || !configPass) {
    const eth = await getEtherealAccount();
    const transport = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: eth.user, pass: eth.pass },
    });
    return { transport, isEthereal: true };
  }

  const host = (await getConfig("MAIL_HOST")) ?? process.env["MAIL_HOST"] ?? "smtp.ethereal.email";
  const portStr = (await getConfig("MAIL_PORT")) ?? process.env["MAIL_PORT"] ?? "587";
  const transport = nodemailer.createTransport({
    host,
    port: parseInt(portStr, 10),
    secure: false,
    auth: { user: configUser, pass: configPass },
  });
  return { transport, isEthereal: false };
}

async function getFromAddress(): Promise<{ name: string; addr: string }> {
  const name = (await getConfig("MAIL_FROM_NAME")) ?? process.env["MAIL_FROM_NAME"] ?? "eCompara";
  const addr = (await getConfig("MAIL_FROM_ADDRESS")) ?? process.env["MAIL_FROM_ADDRESS"] ?? "noreply@ecompara.com.br";
  return { name, addr };
}

// ── Código de verificação ─────────────────────────────────────────────────────

export interface SendVerificationCodeOptions {
  to: string;
  storeName: string;
  code: string;
  registrationId: number;
}

export async function sendVerificationCode(opts: SendVerificationCodeOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Seu código de verificação eCompara: ${opts.code}`,
      text: [
        `Olá!`,
        ``,
        `Recebemos seu cadastro para o estabelecimento "${opts.storeName}" na plataforma eCompara.`,
        ``,
        `Seu código de verificação é:`,
        ``,
        `  ${opts.code}`,
        ``,
        `Digite esse código no aplicativo para confirmar a propriedade do estabelecimento.`,
        `O código expira em 30 minutos.`,
        ``,
        `Se você não solicitou este cadastro, ignore este e-mail.`,
        ``,
        `Equipe eCompara`,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#CC0000;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">eCompara</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Plataforma de comparação de preços</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">Olá!</p>
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
            Recebemos seu cadastro para o estabelecimento <strong>${opts.storeName}</strong> na plataforma eCompara.
          </p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;">Seu código de verificação é:</p>
          <div style="background:#f9f9f9;border:2px dashed #CC0000;border-radius:10px;padding:20px;text-align:center;margin:16px 0;">
            <span style="font-size:42px;font-weight:700;color:#CC0000;letter-spacing:10px;">${opts.code}</span>
          </div>
          <p style="margin:0 0 16px;color:#555;font-size:13px;line-height:1.6;">
            Digite esse código no aplicativo para confirmar a propriedade do estabelecimento.<br>
            <strong>O código expira em 30 minutos.</strong>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">Se você não solicitou este cadastro, ignore este e-mail com segurança.</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">© 2026 eCompara · Todos os direitos reservados</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    const previewUrl = isEthereal ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (previewUrl) {
      console.log(`[Email] ✅ Código de verificação enviado (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] ✅ Código de verificação enviado para ${opts.to} — messageId: ${info.messageId}`);
    }

    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar código de verificação:", err);
    return { sent: false };
  }
}

export async function sendResendCode(opts: SendVerificationCodeOptions): Promise<EmailSendResult> {
  return sendVerificationCode(opts);
}

// ── E-mail de suporte ─────────────────────────────────────────────────────────

export interface SendSupportEmailOptions {
  fromName: string;
  fromEmail: string;
  subject: string;
  message: string;
}

export async function sendSupportEmail(opts: SendSupportEmailOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: "suporte@ecompara.com.br",
      replyTo: `"${opts.fromName}" <${opts.fromEmail}>`,
      subject: `[Suporte] ${opts.subject}`,
      text: [
        `Nova mensagem de suporte recebida:`,
        ``,
        `Nome: ${opts.fromName}`,
        `E-mail: ${opts.fromEmail}`,
        ``,
        `Mensagem:`,
        opts.message,
        ``,
        `---`,
        `Enviado automaticamente pelo sistema eCompara`,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#CC0000;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">eCompara</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Nova mensagem de suporte</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#f9f9f9;border-radius:10px;padding:16px;border:1px solid #eee;">
            <tr>
              <td style="padding:4px 0;color:#888;font-size:12px;width:80px;">Nome</td>
              <td style="padding:4px 0;color:#333;font-size:14px;font-weight:600;">${opts.fromName}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#888;font-size:12px;">E-mail</td>
              <td style="padding:4px 0;"><a href="mailto:${opts.fromEmail}" style="color:#CC0000;font-size:14px;">${opts.fromEmail}</a></td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#888;font-size:12px;">Assunto</td>
              <td style="padding:4px 0;color:#333;font-size:14px;">${opts.subject}</td>
            </tr>
          </table>
          <p style="margin:0 0 8px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Mensagem</p>
          <div style="background:#f9f9f9;border-left:4px solid #CC0000;border-radius:0 8px 8px 0;padding:16px;color:#333;font-size:14px;line-height:1.7;white-space:pre-wrap;">${opts.message}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">Enviado automaticamente pelo sistema eCompara. Responda diretamente a este e-mail para falar com o usuário.</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">© 2026 eCompara · Todos os direitos reservados</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    const previewUrl = isEthereal ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (previewUrl) {
      console.log(`[Email] ✅ E-mail de suporte enviado (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] ✅ E-mail de suporte enviado — messageId: ${info.messageId}`);
    }

    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar e-mail de suporte:", err);
    return { sent: false };
  }
}

// ── Convite de novo parceiro ───────────────────────────────────────────────────

export interface SendClaimInvitationOptions {
  to: string;
  ownerName: string;
  storeName: string;
  registrationId: number;
}

export async function sendClaimInvitation(opts: SendClaimInvitationOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();
  const appLink = `ecompara://merchant-register?registration_id=${opts.registrationId}`;

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Seu pedido de parceria foi aprovado — complete seu cadastro no eCompara`,
      text: [
        `Olá, ${opts.ownerName}!`,
        ``,
        `Ótima notícia! Seu pedido de parceria para o estabelecimento "${opts.storeName}" foi aprovado pela nossa equipe.`,
        ``,
        `Para finalizar, acesse o aplicativo eCompara: Perfil → Cadastrar Estabelecimento`,
        ``,
        `Seu ID de cadastro pré-aprovado é: #${opts.registrationId}`,
        ``,
        `Equipe eCompara`,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#CC0000;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">eCompara</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Plataforma de comparação de preços</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">Olá, <strong>${opts.ownerName}</strong>!</p>
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
            Ótima notícia! Seu pedido de parceria para o estabelecimento
            <strong>${opts.storeName}</strong> foi <span style="color:#009900;font-weight:700;">aprovado</span>
            pela nossa equipe.
          </p>
          <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">
            Para finalizar, complete o cadastro no aplicativo eCompara.<br>
            Acesse <strong>Perfil → Cadastrar Estabelecimento</strong> e informe o ID abaixo:
          </p>
          <div style="background:#f9f9f9;border:2px dashed #CC0000;border-radius:10px;padding:20px;text-align:center;margin:16px 0;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">ID de Cadastro</p>
            <span style="font-size:36px;font-weight:700;color:#CC0000;letter-spacing:6px;">#${opts.registrationId}</span>
          </div>
          <div style="text-align:center;margin:20px 0;">
            <a href="${appLink}" style="background:#CC0000;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
              Completar Cadastro no App
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">Se você não solicitou este cadastro, ignore este e-mail com segurança.</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">© 2026 eCompara · Todos os direitos reservados</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    const previewUrl = isEthereal ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (previewUrl) {
      console.log(`[Email] ✅ Convite de parceria enviado (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] ✅ Convite de parceria enviado para ${opts.to} — messageId: ${info.messageId}`);
    }

    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar convite de parceria:", err);
    return { sent: false };
  }
}
