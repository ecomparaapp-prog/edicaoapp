import nodemailer from "nodemailer";
import { getConfig } from "./configService";

async function createTransporter() {
  const host = (await getConfig("MAILTRAP_HOST")) ?? process.env["MAILTRAP_HOST"] ?? "sandbox.smtp.mailtrap.io";
  const portStr = (await getConfig("MAILTRAP_PORT")) ?? process.env["MAILTRAP_PORT"] ?? "587";
  const port = parseInt(portStr, 10);
  const user = (await getConfig("MAILTRAP_USER")) ?? process.env["MAILTRAP_USER"];
  const pass = (await getConfig("MAILTRAP_PASS")) ?? process.env["MAILTRAP_PASS"];

  if (!user || !pass) {
    console.warn("[Email] MAILTRAP_USER ou MAILTRAP_PASS não configurados — e-mails não serão enviados.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
}

async function getFromAddress(): Promise<{ name: string; addr: string }> {
  const name = (await getConfig("MAIL_FROM_NAME")) ?? process.env["MAIL_FROM_NAME"] ?? "eCompara";
  const addr = (await getConfig("MAIL_FROM_ADDRESS")) ?? process.env["MAIL_FROM_ADDRESS"] ?? "noreply@ecompara.com.br";
  return { name, addr };
}

export interface SendVerificationCodeOptions {
  to: string;
  storeName: string;
  code: string;
  registrationId: number;
}

export async function sendVerificationCode(opts: SendVerificationCodeOptions): Promise<boolean> {
  const transporter = await createTransporter();

  if (!transporter) {
    console.log(`[Email] (sem transporter) Código de verificação para ${opts.to}: ${opts.code}`);
    return false;
  }

  const { name: fromName, addr: fromAddr } = await getFromAddress();

  try {
    const info = await transporter.sendMail({
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
        <!-- Header -->
        <tr><td style="background:#CC0000;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">eCompara</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Plataforma de comparação de preços</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">Olá!</p>
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
            Recebemos seu cadastro para o estabelecimento <strong>${opts.storeName}</strong> na plataforma eCompara.
          </p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;">Seu código de verificação é:</p>
          <!-- Code box -->
          <div style="background:#f9f9f9;border:2px dashed #CC0000;border-radius:10px;padding:20px;text-align:center;margin:16px 0;">
            <span style="font-size:42px;font-weight:700;color:#CC0000;letter-spacing:10px;">${opts.code}</span>
          </div>
          <p style="margin:0 0 16px;color:#555;font-size:13px;line-height:1.6;">
            Digite esse código no aplicativo para confirmar a propriedade do estabelecimento.<br>
            <strong>O código expira em 30 minutos.</strong>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">
            Se você não solicitou este cadastro, ignore este e-mail com segurança.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
            © 2026 eCompara · Todos os direitos reservados
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    console.log(`[Email] Enviado para ${opts.to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("[Email] Falha ao enviar e-mail:", err);
    return false;
  }
}

export async function sendResendCode(opts: SendVerificationCodeOptions): Promise<boolean> {
  return sendVerificationCode(opts);
}

export interface SendClaimInvitationOptions {
  to: string;
  ownerName: string;
  storeName: string;
  registrationId: number;
}

export async function sendClaimInvitation(opts: SendClaimInvitationOptions): Promise<boolean> {
  const transporter = await createTransporter();
  const appLink = `ecompara://merchant-register?registration_id=${opts.registrationId}`;

  if (!transporter) {
    console.log(`[Email] (sem transporter) Convite de claim para ${opts.to} — registrationId: ${opts.registrationId}`);
    return false;
  }

  const { name: fromName, addr: fromAddr } = await getFromAddress();

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Seu pedido de parceria foi aprovado — complete seu cadastro no eCompara`,
      text: [
        `Olá, ${opts.ownerName}!`,
        ``,
        `Ótima notícia! Seu pedido de parceria para o estabelecimento "${opts.storeName}" foi aprovado pela nossa equipe.`,
        ``,
        `Para finalizar, você precisa completar o cadastro completo no aplicativo eCompara.`,
        `Abra o aplicativo e acesse: Perfil → Cadastrar Estabelecimento`,
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
            Para finalizar, você precisa completar o cadastro no aplicativo eCompara.<br>
            Acesse <strong>Perfil → Cadastrar Estabelecimento</strong> e informe o ID abaixo:
          </p>
          <div style="background:#f9f9f9;border:2px dashed #CC0000;border-radius:10px;padding:20px;text-align:center;margin:16px 0;">
            <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">ID de Cadastro</p>
            <span style="font-size:36px;font-weight:700;color:#CC0000;letter-spacing:6px;">#${opts.registrationId}</span>
          </div>
          <p style="margin:16px 0 0;color:#555;font-size:13px;line-height:1.6;">
            Você também pode tocar no botão abaixo para abrir o app diretamente:
          </p>
          <div style="text-align:center;margin:20px 0;">
            <a href="${appLink}" style="background:#CC0000;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
              Completar Cadastro no App
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">
            Se você não solicitou este cadastro, ignore este e-mail com segurança.
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
            © 2026 eCompara · Todos os direitos reservados
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    console.log(`[Email] Convite de claim enviado para ${opts.to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("[Email] Falha ao enviar convite de claim:", err);
    return false;
  }
}
