from __future__ import annotations

import re

from croniter import croniter

from app.schemas import CrontabParseResult, ParsedJob

# All supported @aliases (must include the leading @)
_ALIASES = frozenset(
    {"@yearly", "@annually", "@monthly", "@weekly", "@daily", "@midnight", "@hourly", "@reboot"}
)


def _is_env_var(line: str) -> bool:
    """Detect environment variable assignments like MAILTO=root or PATH=/usr/bin."""
    return bool(re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*=", line))


def _validate_schedule(schedule: str) -> str | None:
    """Return an error string if the schedule is invalid, None otherwise."""
    if schedule == "@reboot":
        return None  # @reboot is not time-based, croniter can't validate it
    if not croniter.is_valid(schedule):
        return f"Invalid cron expression: '{schedule}'"
    return None


def _try_parse_cron_line(text: str) -> tuple[str, str] | None:
    """
    Try to interpret *text* as a cron job line.

    Returns (schedule, command) on success, None if the text doesn't look like
    a cron line (wrong number of fields, not an alias, …).
    """
    text = text.strip()
    if not text:
        return None

    first, *rest = text.split(None, 1)

    # @alias format — the first token must literally start with '@'
    if first.startswith("@") and first.lower() in _ALIASES:
        schedule = first.lower()
        command = rest[0].strip() if rest else ""
        return schedule, command

    # Standard 5-field format: min hour dom mon dow [command]
    parts = text.split(None, 5)
    if len(parts) >= 5:
        schedule = " ".join(parts[:5])
        command = parts[5].strip() if len(parts) > 5 else ""
        return schedule, command

    return None


def parse_crontab(raw_text: str) -> CrontabParseResult:
    """
    Parse a raw crontab string and return structured job data.

    Rules:
    - Empty lines are skipped.
    - Environment variable assignments (VAR=value) are skipped.
    - Lines starting with '#' that don't look like a cron job are treated as
      pure comments and skipped.
    - Lines starting with '#' that look like a cron job are parsed as
      *disabled* jobs (enabled=False).
    - Lines with an unrecognised format produce a warning and are skipped.
    - Lines with a syntactically invalid schedule are kept (enabled=True) but
      carry a non-null *error* field and a warning.
    """
    jobs: list[ParsedJob] = []
    warnings: list[str] = []

    for i, line in enumerate(raw_text.splitlines(), start=1):
        stripped = line.strip()

        if not stripped:
            continue

        if _is_env_var(stripped):
            continue

        if stripped.startswith("#"):
            inner = stripped.lstrip("#").strip()
            parsed = _try_parse_cron_line(inner)
            if parsed is None:
                # Not enough fields — pure comment
                continue
            schedule, command = parsed
            # Only treat as a disabled job when the schedule is recognisably
            # valid; otherwise it is just a prose comment (e.g. "# m h dom mon dow command").
            if schedule != "@reboot" and not croniter.is_valid(schedule):
                continue
            jobs.append(
                ParsedJob(
                    line_number=i,
                    raw_line=line,
                    schedule=schedule,
                    command=command,
                    enabled=False,
                    error=None,
                )
            )
            continue

        parsed = _try_parse_cron_line(stripped)
        if parsed is None:
            warnings.append(f"Line {i}: unrecognised format, skipped")
            continue

        schedule, command = parsed
        error = _validate_schedule(schedule)
        if error:
            warnings.append(f"Line {i}: {error}")

        jobs.append(
            ParsedJob(
                line_number=i,
                raw_line=line,
                schedule=schedule,
                command=command,
                enabled=True,
                error=error,
            )
        )

    return CrontabParseResult(jobs=jobs, warnings=warnings)
