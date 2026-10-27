"""Strict subset of 1CClientBankExchange. No PDF guessing or silent column guessing."""

import hashlib
import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation


class StatementError(ValueError):
    pass


def money(value):
    try:
        number = Decimal(value.replace(" ", "").replace("\xa0", "").replace(",", "."))
        if not number.is_finite() or number <= 0 or number > Decimal("100000000000"):
            raise ValueError()
        if number * 100 != (number * 100).to_integral_value():
            raise ValueError()
        return int(number * 100)
    except (InvalidOperation, ValueError):
        raise StatementError("Сумма должна быть положительной, с точностью до копейки") from None


def parse_1c(data: bytes, company_inn: str | None):
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = data.decode("cp1251")
        except UnicodeDecodeError:
            raise StatementError("Не удалось прочитать кодировку UTF-8 или Windows-1251") from None
    lines = text.splitlines()
    if not lines or lines[0].strip() != "1CClientBankExchange":
        raise StatementError("Нужна выписка 1С TXT с заголовком 1CClientBankExchange")
    if not company_inn:
        raise StatementError("Перед импортом укажите ИНН компании в профиле")
    if "КонецФайла" not in [line.strip() for line in lines]:
        raise StatementError("Файл оборван: отсутствует КонецФайла")
    documents, errors = [], []
    record = None
    start_line = 0
    for number, raw in enumerate(lines[1:], 2):
        line = raw.strip()
        if line.startswith("СекцияДокумент="):
            if record is not None:
                raise StatementError("Вложенные секции документов")
            record, start_line = {"Тип": line.split("=", 1)[1]}, number
        elif line == "КонецДокумента":
            if record is None:
                raise StatementError("КонецДокумента без начала")
            try:
                documents.append(normalize(record, company_inn))
            except (StatementError, ValueError) as exc:
                errors.append({"line": start_line, "message": str(exc)})
            record = None
        elif record is not None and "=" in line:
            key, value = line.split("=", 1)
            if key in record:
                raise StatementError(f"Повтор поля в документе: {key}")
            record[key] = value
    if record is not None:
        raise StatementError("Незакрытая секция документа")
    if not documents and not errors:
        raise StatementError("В файле нет документов платежей")
    return documents, errors


def normalize(record, own_inn):
    for key in ("Дата", "Номер", "Сумма", "ПлательщикИНН", "ПолучательИНН"):
        if not record.get(key):
            raise StatementError(f"Нет обязательного поля {key}")
    try:
        date = datetime.strptime(record["Дата"], "%d.%m.%Y").date().isoformat()
    except ValueError:
        raise StatementError("Неверная дата платежа; ожидается ДД.ММ.ГГГГ") from None
    payer, receiver = record["ПлательщикИНН"], record["ПолучательИНН"]
    if own_inn not in {payer, receiver}:
        raise StatementError("ИНН компании не совпадает с плательщиком или получателем")
    direction = "outgoing" if payer == own_inn else "incoming"
    prefix = "Получатель" if direction == "outgoing" else "Плательщик"
    inn = record[f"{prefix}ИНН"]
    if not re.fullmatch(r"\d{10}(\d{2})?", inn):
        raise StatementError("Некорректный ИНН контрагента")
    name = record.get(prefix) or record.get(f"{prefix}1")
    if not name:
        raise StatementError("Нет наименования контрагента")
    result = {
        "date": date,
        "amount_minor": money(record["Сумма"]),
        "direction": direction,
        "counterparty": name,
        "counterparty_inn": inn,
        "purpose": record.get("НазначениеПлатежа", ""),
    }
    # A deterministic identity scoped by company, independent of filename/encoding.
    identity = [
        record["Тип"],
        record["Номер"],
        date,
        result["amount_minor"],
        payer,
        receiver,
        record.get("ПлательщикСчет", record.get("ПлательщикРасчСчет", "")),
        record.get("ПолучательСчет", record.get("ПолучательРасчСчет", "")),
    ]
    result["fingerprint"] = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
    return result
