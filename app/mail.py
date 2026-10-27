import smtplib
import ssl
import json
import urllib.request
import urllib.error
from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4
from html import escape
from urllib.parse import urlencode
from app.config import settings


def deliver(msg):
    cfg = settings()
    if cfg.mail_mode == "resend":
        payload = {
            "from": str(msg["From"]),
            "to": [str(msg["To"])],
            "subject": str(msg["Subject"]),
            "text": msg.get_body(preferencelist=("plain",)).get_content(),
        }
        html_body = msg.get_body(preferencelist=("html",))
        if html_body is not None:
            payload["html"] = html_body.get_content()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": "Bearer " + cfg.resend_api_key.get_secret_value(),
                "Content-Type": "application/json",
                "User-Agent": "Optima/0.2",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                json.load(response)
        except (urllib.error.URLError, ValueError):
            raise OSError("Mail provider unavailable") from None
    elif cfg.mail_mode == "file":
        folder = Path(cfg.mail_dir)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{uuid4()}.eml").write_bytes(msg.as_bytes())
    else:
        with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=10) as smtp:
            if cfg.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if cfg.smtp_username:
                smtp.login(cfg.smtp_username, cfg.smtp_password)
            smtp.send_message(msg)


def code_email_html(recipient, code, purpose, link):
    """Inline/table layout: works without images, scripts or remote fonts in email clients."""
    title = "Подтвердите вашу почту" if purpose == "create" else "С возвращением в Оптима"
    return f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><title>{title}</title>
<style>@media only screen and (max-width:620px){{.outer{{padding:20px 10px!important}}.inner{{padding:28px 22px!important}}.headline{{font-size:29px!important}}.code{{font-size:32px!important;letter-spacing:8px!important}}}}</style></head>
<body style="margin:0;padding:0;background:#eef3fb;color:#172b4d;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Ваш код: {escape(code)}. Подтвердите вход в Оптима. Код действует 10 минут.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef3fb"><tr><td class="outer" align="center" style="padding:44px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 8px 20px;font-size:24px;font-weight:800;letter-spacing:-1px;color:#164fdb">❯❯ <span style="color:#203757">оптима</span></td></tr>
<tr><td bgcolor="#1255ed" class="inner" style="padding:36px 40px;background-color:#1255ed;background-image:linear-gradient(125deg,#123b9c 0%,#1656ee 55%,#4387ff 100%);border-radius:20px 20px 0 0;color:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#d6e5ff">БИЗНЕС БЛИЖЕ. ЗАКУПКИ ВЫГОДНЕЕ.</td><td align="right" style="color:#abcaff;font-size:26px">✦</td></tr></table>
<h1 class="headline" style="margin:22px 0 12px;font-size:34px;line-height:1.18;letter-spacing:-1px;color:#ffffff">{title}</h1>
<p style="margin:0;font-size:15px;line-height:1.7;color:#dfebff">Ваше рабочее пространство для совместных закупок — в одном подтверждении.</p>
</td></tr>
<tr><td bgcolor="#ffffff" class="inner" style="padding:34px 40px 36px;border-radius:0 0 20px 20px">
<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4a5c78">Используйте этот одноразовый код для <span style="font-weight:bold;color:#172b4d">{escape(recipient)}</span>:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#f2f6ff" style="padding:24px 12px;border:1px solid #dce7ff;border-radius:12px">
<div style="font-size:10px;letter-spacing:2px;font-weight:bold;color:#617594;margin-bottom:12px">КОД ПОДТВЕРЖДЕНИЯ</div>
<div class="code" style="font-family:Consolas,'Courier New',monospace;font-size:40px;line-height:1.2;font-weight:bold;letter-spacing:10px;color:#144fe5">{escape(code)}</div>
<div style="margin-top:12px;font-size:12px;color:#6a7b95">Действует 10 минут · используется один раз</div>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td align="center" bgcolor="#1555ee" style="border-radius:10px;mso-padding-alt:17px 20px">
<a href="{escape(link, quote=True)}" style="display:block;padding:17px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:10px">Открыть и подтвердить &nbsp; →</a>
</td></tr></table>
<p style="margin:14px 0 26px;font-size:12px;line-height:1.7;text-align:center;color:#73829a">Кнопка откроет сайт с заполненным кодом.<br>Останется нажать «Подтвердить и войти».</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #edf0f5"><tr><td style="padding-top:22px;font-size:12px;line-height:1.8;color:#78869c">Никому не сообщайте код и не пересылайте это письмо.<br>Не запрашивали вход? Просто проигнорируйте письмо.</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0;font-size:11px;line-height:1.8;color:#8795ab">Оптима · совместные закупки для бизнеса<br>Автоматическое письмо. Отвечать на него не нужно.</td></tr>
</table></td></tr></table></body></html>'''


def send_code_email(recipient, code, purpose, challenge_id):
    # AI: fragment stays out of HTTP access logs; opening the link never consumes a code.
    link = settings().frontend_url.rstrip("/") + "/#email-code?" + urlencode(
        {"email": recipient, "challenge": challenge_id, "code": code}
    )
    msg = EmailMessage()
    msg["From"] = settings().mail_from
    msg["To"] = recipient
    msg["Subject"] = f"{code} — код входа в Оптима"
    msg.set_content(
        f"Ваш код: {code}\n\nКод действует 10 минут и используется один раз.\n"
        f"Открыть и подтвердить: {link}\nНа сайте нажмите «Подтвердить и войти».\n\n"
        "Если вы не запрашивали вход, проигнорируйте письмо.\n\nОптима"
    )
    msg.add_alternative(code_email_html(recipient, code, purpose, link), subtype="html")
    deliver(msg)


def send_token_email(recipient, token, kind):
    cfg = settings()
    route = "verify-email" if kind == "verify" else "reset-password"
    link = f"{cfg.frontend_url.rstrip('/')}/{route}?token={token}"
    msg = EmailMessage()
    msg["From"] = cfg.mail_from
    msg["To"] = recipient
    msg["Subject"] = "Подтверждение почты" if kind == "verify" else "Восстановление пароля"
    msg.set_content(
        f"{msg['Subject']}\n\nОткройте ссылку: {link}\n\nЕсли вы не запрашивали это письмо, проигнорируйте его.\n"
    )
    deliver(msg)
