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

// ── Aprovação de anunciante ────────────────────────────────────────────────────

export interface SendAdvertiserApprovalOptions {
  to: string;
  contactName: string;
  companyName: string;
  tempPassword: string;
  loginUrl?: string;
}

export async function sendAdvertiserApproval(opts: SendAdvertiserApprovalOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();
  const loginUrl = opts.loginUrl ?? "https://anunciantes.ecompara.com.br/login";

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Bem-vindo ao eCompara Anunciantes — Seu acesso foi liberado!`,
      text: [
        `Olá, ${opts.contactName}!`,
        ``,
        `Sua conta de anunciante para a empresa "${opts.companyName}" foi APROVADA.`,
        ``,
        `Seus dados de acesso:`,
        `  E-mail: ${opts.to}`,
        `  Senha temporária: ${opts.tempPassword}`,
        ``,
        `Acesse o portal: ${loginUrl}`,
        ``,
        `Por segurança, altere sua senha após o primeiro acesso.`,
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
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:0.5px;">eCompara Anunciantes</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Portal B2B de Marcas e Indústrias</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#009900;font-size:18px;font-weight:700;">✅ Cadastro Aprovado!</p>
          <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">
            Olá, <strong>${opts.contactName}</strong>! A conta de anunciante para
            <strong>${opts.companyName}</strong> foi aprovada com sucesso.
          </p>
          <p style="margin:0 0 8px;color:#555;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Seus dados de acesso:</p>
          <div style="background:#f9f9f9;border:1px solid #eee;border-radius:10px;padding:20px;margin:16px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#888;font-size:13px;padding:6px 0;width:110px;">E-mail</td>
                <td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;">${opts.to}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;padding:6px 0;">Senha temporária</td>
                <td style="color:#CC0000;font-size:18px;font-weight:700;letter-spacing:3px;padding:6px 0;">${opts.tempPassword}</td>
              </tr>
            </table>
          </div>
          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${loginUrl}" style="background:#CC0000;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">
              Acessar o Portal do Anunciante
            </a>
          </div>
          <p style="margin:16px 0 0;color:#999;font-size:12px;text-align:center;">Por segurança, altere sua senha após o primeiro acesso.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;">Se você não solicitou este acesso, entre em contato com suporte@ecompara.com.br</p>
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
      console.log(`[Email] ✅ Aprovação de anunciante enviada (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] ✅ Aprovação de anunciante enviada para ${opts.to} — messageId: ${info.messageId}`);
    }

    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar e-mail de aprovação de anunciante:", err);
    return { sent: false };
  }
}

// ── Boas-vindas ao Lojista ────────────────────────────────────────────────────

export interface SendMerchantWelcomeOptions {
  to: string;
  ownerName: string;
  storeName: string;
  tempPassword: string;
  portalUrl?: string;
}

export async function sendMerchantWelcome(opts: SendMerchantWelcomeOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();
  const portalUrl = opts.portalUrl ?? "https://lojistas.ecompara.com.br/login";

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Acesso liberado — Portal Lojista eCompara`,
      text: [
        `Prezado(a) ${opts.ownerName},`,
        ``,
        `Seu cadastro para o estabelecimento "${opts.storeName}" foi aprovado.`,
        `Segue abaixo suas credenciais de acesso ao Portal Lojista eCompara:`,
        ``,
        `  E-mail: ${opts.to}`,
        `  Senha temporária: ${opts.tempPassword}`,
        ``,
        `Acesse: ${portalUrl}`,
        ``,
        `Por segurança, você será solicitado a definir uma nova senha no primeiro acesso.`,
        ``,
        `Equipe eCompara`,
      ].join("\n"),
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- HEADER / LOGO -->
        <tr><td style="background:#0F172A;padding:32px 40px 28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <!-- Ícone "e" estilizado como logomarca -->
                <div style="width:48px;height:48px;background:#CC0000;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:26px;font-weight:900;font-family:Arial,sans-serif;line-height:1;padding:0 0 2px 2px;">e</span>
                </div>
              </td>
              <td style="vertical-align:middle;">
                <div style="color:#FFFFFF;font-size:22px;font-weight:800;letter-spacing:-0.5px;line-height:1;font-family:Arial,sans-serif;">
                  e<span style="color:#CC0000;">Compara</span>
                </div>
                <div style="color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-top:5px;font-family:Arial,sans-serif;">
                  Portal do Lojista
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- BADGE STATUS -->
        <tr><td style="background:#CC0000;padding:10px 40px;">
          <p style="margin:0;color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;">
            Acesso Liberado — Cadastro Aprovado
          </p>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">
            Credenciais de Acesso ao Painel
          </p>
          <h2 style="margin:0 0 20px;color:#0F172A;font-size:22px;font-weight:800;letter-spacing:-0.3px;line-height:1.3;font-family:Arial,sans-serif;">
            Bem-vindo(a), ${opts.ownerName}
          </h2>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.8;font-family:Arial,sans-serif;">
            O cadastro de <strong style="color:#0F172A;">${opts.storeName}</strong> foi validado e seu acesso ao
            Portal Lojista eCompara foi liberado. Utilize as credenciais abaixo para entrar na plataforma.
          </p>

          <!-- CREDENCIAIS -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px 12px;">
                <p style="margin:0 0 4px;color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">E-mail de Acesso</p>
                <p style="margin:0;color:#0F172A;font-size:15px;font-weight:600;font-family:Arial,sans-serif;">${opts.to}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px;"><div style="height:1px;background:#E2E8F0;"></div></td>
            </tr>
            <tr>
              <td style="padding:12px 24px 20px;">
                <p style="margin:0 0 4px;color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">Senha Temporaria de Acesso</p>
                <p style="margin:0;color:#CC0000;font-size:26px;font-weight:800;letter-spacing:6px;font-family:'Courier New',monospace;">${opts.tempPassword}</p>
              </td>
            </tr>
          </table>

          <!-- AVISO -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;margin-bottom:28px;">
            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0;color:#92400E;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;">
                  <strong>Importante:</strong> Por seguranca, voce sera solicitado a criar uma nova senha no primeiro acesso. A senha temporaria expira apos o primeiro uso.
                </p>
              </td>
            </tr>
          </table>

          <!-- CTA BUTTON -->
          <div style="text-align:center;margin:0 0 8px;">
            <a href="${portalUrl}" style="background:#CC0000;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:9px;font-size:14px;font-weight:700;display:inline-block;letter-spacing:0.5px;font-family:Arial,sans-serif;">
              Acessar Plataforma
            </a>
          </div>
          <p style="margin:14px 0 0;color:#94A3B8;font-size:12px;text-align:center;font-family:Arial,sans-serif;">
            Ou acesse: <a href="${portalUrl}" style="color:#CC0000;text-decoration:none;">${portalUrl}</a>
          </p>

          <div style="height:1px;background:#E2E8F0;margin:28px 0;"></div>
          <p style="margin:0;color:#94A3B8;font-size:11px;line-height:1.7;font-family:Arial,sans-serif;">
            Duvidas ou problemas de acesso? Fale conosco em
            <a href="mailto:parceiros@ecompara.com.br" style="color:#CC0000;text-decoration:none;">parceiros@ecompara.com.br</a>
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#F8FAFC;padding:18px 40px;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;font-family:Arial,sans-serif;">
            © 2026 eCompara · Todos os direitos reservados<br>
            <span style="font-size:10px;">Se voce nao solicitou este acesso, ignore este e-mail.</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    const previewUrl = isEthereal ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (previewUrl) {
      console.log(`[Email] Boas-vindas lojista enviado (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] Boas-vindas lojista enviado para ${opts.to} — messageId: ${info.messageId}`);
    }
    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar boas-vindas lojista:", err);
    return { sent: false };
  }
}

// ── Reset de senha do lojista ─────────────────────────────────────────────────

export interface SendPasswordResetOptions {
  to: string;
  ownerName: string;
  resetLink: string;
}

export async function sendPasswordReset(opts: SendPasswordResetOptions): Promise<EmailSendResult> {
  const { transport, isEthereal } = await createTransporter();
  const { name: fromName, addr: fromAddr } = await getFromAddress();

  try {
    const info = await transport.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: opts.to,
      subject: `Redefinicao de senha — Portal Lojista eCompara`,
      text: [
        `Prezado(a) ${opts.ownerName},`,
        ``,
        `Recebemos uma solicitacao de redefinicao de senha para sua conta.`,
        ``,
        `Clique no link abaixo para criar uma nova senha (valido por 30 minutos):`,
        `${opts.resetLink}`,
        ``,
        `Se voce nao solicitou essa alteracao, ignore este e-mail.`,
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
      <table width="100%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0F172A;padding:28px 36px;">
          <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:0.5px;">eCompara</h1>
          <p style="margin:6px 0 0;color:#94A3B8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Portal do Lojista</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="margin:0 0 6px;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Seguranca da Conta</p>
          <h2 style="margin:0 0 20px;color:#0F172A;font-size:22px;">Redefinicao de Senha</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
            Prezado(a) <strong>${opts.ownerName}</strong>, recebemos uma solicitacao de redefinicao de senha.
            Clique no botao abaixo para criar uma nova senha. Este link expira em <strong>30 minutos</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${opts.resetLink}" style="background:#CC0000;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;letter-spacing:0.5px;">
              Redefinir Senha
            </a>
          </div>
          <p style="margin:20px 0 0;color:#94A3B8;font-size:12px;text-align:center;">
            Ou acesse diretamente: <a href="${opts.resetLink}" style="color:#CC0000;">${opts.resetLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0;">
          <p style="margin:0;color:#94A3B8;font-size:11px;">
            Se voce nao solicitou esta alteracao, ignore este e-mail. Sua senha permanecera a mesma.
          </p>
        </td></tr>
        <tr><td style="background:#F8FAFC;padding:16px 36px;border-top:1px solid #E2E8F0;">
          <p style="margin:0;color:#94A3B8;font-size:11px;text-align:center;">© 2026 eCompara · Todos os direitos reservados</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    const previewUrl = isEthereal ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (previewUrl) {
      console.log(`[Email] Reset de senha enviado (Ethereal) → ${previewUrl}`);
    } else {
      console.log(`[Email] Reset de senha enviado para ${opts.to} — messageId: ${info.messageId}`);
    }
    return { sent: true, previewUrl };
  } catch (err) {
    console.error("[Email] Falha ao enviar reset de senha:", err);
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
