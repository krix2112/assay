"""Delivery mechanisms for daily Assay brief."""

import smtplib
from datetime import UTC, date, datetime
from email.message import EmailMessage

import httpx
import structlog
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.track_record import BriefSentRecord

logger = structlog.get_logger(__name__)


def sanitize_secrets(msg: str) -> str:
    """Strip secret tokens or passwords from error text before logging or storing."""
    cleaned = msg
    if settings.TELEGRAM_BOT_TOKEN:
        cleaned = cleaned.replace(settings.TELEGRAM_BOT_TOKEN, "[REDACTED_TELEGRAM_TOKEN]")
    if settings.SMTP_PASSWORD:
        cleaned = cleaned.replace(settings.SMTP_PASSWORD, "[REDACTED_SMTP_PASSWORD]")
    return cleaned


def send_telegram(brief_text: str, token: str, chat_id: str) -> None:
    """Send text message to Telegram chat via Bot API."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": brief_text}
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()


def send_email(subject: str, brief_text: str) -> None:
    """Send brief text via SMTP fallback."""
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = settings.SMTP_TO
    msg.set_content(brief_text)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0) as server:
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def deliver_brief(
    session: Session,
    trade_date: date,
    brief_text: str,
    dry_run: bool | None = None,
) -> BriefSentRecord:
    """Deliver daily brief via configured channels or execute a dry run.

    Logs delivery attempts and writes to briefs_sent audit table.
    """
    is_dry_run = settings.BRIEF_DRY_RUN if dry_run is None else dry_run

    if is_dry_run:
        logger.info(
            "Executing brief dry run (delivery suppressed)", trade_date=trade_date.isoformat()
        )
        print(f"\n--- [DAILY BRIEF DRY RUN: {trade_date.isoformat()}] ---")
        print(brief_text)
        print("------------------------------------------------------\n")

        audit_entry = BriefSentRecord(
            trade_date=trade_date,
            channel="dry_run",
            status="dry_run",
            error_text=None,
            created_at=datetime.now(UTC),
        )
        session.add(audit_entry)
        session.flush()
        return audit_entry

    telegram_attempted = False
    telegram_error: str | None = None

    # 1. Attempt Telegram
    if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
        telegram_attempted = True
        try:
            send_telegram(brief_text, settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_CHAT_ID)
            audit_entry = BriefSentRecord(
                trade_date=trade_date,
                channel="telegram",
                status="sent",
                error_text=None,
                created_at=datetime.now(UTC),
            )
            session.add(audit_entry)
            session.flush()
            logger.info("Daily brief delivered via Telegram", trade_date=trade_date.isoformat())
            return audit_entry
        except Exception as e:
            telegram_error = sanitize_secrets(str(e))
            logger.warning(
                "Telegram delivery failed, attempting email fallback",
                error=telegram_error,
                trade_date=trade_date.isoformat(),
            )

    # 2. Attempt SMTP Email Fallback
    if settings.SMTP_HOST and settings.SMTP_TO:
        try:
            send_email(f"Assay Daily Brief - {trade_date.isoformat()}", brief_text)
            audit_entry = BriefSentRecord(
                trade_date=trade_date,
                channel="email",
                status="sent",
                error_text=None,
                created_at=datetime.now(UTC),
            )
            session.add(audit_entry)
            session.flush()
            logger.info(
                "Daily brief delivered via SMTP email fallback", trade_date=trade_date.isoformat()
            )
            return audit_entry
        except Exception as e:
            email_error = sanitize_secrets(str(e))
            combined_err = (
                f"Telegram error: {telegram_error or 'not configured'}; Email error: {email_error}"
            )
            audit_entry = BriefSentRecord(
                trade_date=trade_date,
                channel="email",
                status="failed",
                error_text=combined_err,
                created_at=datetime.now(UTC),
            )
            session.add(audit_entry)
            session.flush()
            logger.error("All delivery channels failed", error=combined_err)
            raise RuntimeError(f"All notification channels failed: {combined_err}") from e

    # If Telegram failed and no email configured
    if telegram_attempted and telegram_error:
        audit_entry = BriefSentRecord(
            trade_date=trade_date,
            channel="telegram",
            status="failed",
            error_text=telegram_error,
            created_at=datetime.now(UTC),
        )
        session.add(audit_entry)
        session.flush()
        raise RuntimeError(f"Telegram delivery failed: {telegram_error}")

    # No channels configured
    audit_entry = BriefSentRecord(
        trade_date=trade_date,
        channel="none",
        status="skipped",
        error_text="No notification channels configured",
        created_at=datetime.now(UTC),
    )
    session.add(audit_entry)
    session.flush()
    return audit_entry
