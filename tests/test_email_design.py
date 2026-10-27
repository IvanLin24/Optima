import json
from email import policy
from email.parser import BytesParser
from html import unescape
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit

from app.config import settings
from app.mail import code_email_html, send_code_email


def test_styled_email_link_preserves_explicit_code_confirmation(client):
    email = "design+qa@example.com"
    response = client.post(
        "/api/v1/auth/virtual-company", json={"email": email, "password": "VeryStrongPass123!"}
    )
    assert response.status_code == 202
    message = BytesParser(policy=policy.default).parsebytes(next(Path(settings().mail_dir).glob("*.eml")).read_bytes())
    assert message.get_content_type() == "multipart/alternative"
    plain = message.get_body(preferencelist=("plain",)).get_content()
    html = message.get_body(preferencelist=("html",)).get_content()
    assert "Открыть и подтвердить" in html and "Подтвердить и войти" in html
    code = re.search(r"Ваш код: (\d{6})", plain).group(1)
    link = unescape(re.search(r'<a href="([^"]+)"', html).group(1))
    url = urlsplit(link)
    assert url.query == "" and url.fragment.startswith("email-code?")
    params = parse_qs(url.fragment.split("?", 1)[1])
    assert params == {"email": [email], "challenge": [response.json()["challenge_id"]], "code": [code]}
    # Visiting the site never verifies an email challenge; the same code still works once.
    assert client.get("/").status_code in (200, 404)
    body = {"email": email, "challenge_id": params["challenge"][0], "code": code}
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 200
    assert client.post("/api/v1/auth/verify-code", json=body).status_code == 400


def test_resend_receives_plain_and_html_versions(client, monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"id":"synthetic-message"}'

    def send(request, timeout):
        captured.update(json.loads(request.data))
        return Response()

    monkeypatch.setattr(settings(), "mail_mode", "resend")
    monkeypatch.setattr("app.mail.urllib.request.urlopen", send)
    send_code_email("mail@example.com", "012345", "login", "00000000-0000-0000-0000-000000000001")
    assert "012345" in captured["text"] and "012345" in captured["html"]
    assert captured["to"] == ["mail@example.com"]
    assert "<table" in captured["html"] and "<script" not in captured["html"]


def test_email_escapes_interpolated_content():
    html = code_email_html('<test>@example.com', '000000', 'create', 'https://example.com/?a="&b=2')
    assert "&lt;test&gt;" in html
    assert 'href="https://example.com/?a=&quot;&amp;b=2"' in html
