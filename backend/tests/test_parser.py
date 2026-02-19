import pytest

from app.services.parser import parse_crontab


# ---------------------------------------------------------------------------
# Empty / trivial inputs
# ---------------------------------------------------------------------------


def test_empty_string():
    result = parse_crontab("")
    assert result.jobs == []
    assert result.warnings == []


def test_blank_lines_only():
    result = parse_crontab("\n\n   \n\t\n")
    assert result.jobs == []
    assert result.warnings == []


def test_pure_comment_skipped():
    result = parse_crontab("# This is just a comment")
    assert result.jobs == []
    assert result.warnings == []


def test_env_var_skipped():
    for line in ("MAILTO=root", 'MAILTO=""', "PATH=/usr/bin:/usr/sbin", "SHELL=/bin/bash"):
        result = parse_crontab(line)
        assert result.jobs == [], f"Expected no jobs for env var line: {line!r}"


# ---------------------------------------------------------------------------
# Standard 5-field expressions
# ---------------------------------------------------------------------------


def test_standard_job_parsed():
    result = parse_crontab("*/5 * * * * /usr/bin/backup")
    assert len(result.jobs) == 1
    job = result.jobs[0]
    assert job.schedule == "*/5 * * * *"
    assert job.command == "/usr/bin/backup"
    assert job.enabled is True
    assert job.error is None


def test_command_with_arguments():
    result = parse_crontab("0 0 * * * /usr/bin/cmd --flag value --other")
    assert result.jobs[0].command == "/usr/bin/cmd --flag value --other"


def test_no_command():
    result = parse_crontab("0 0 * * *")
    assert result.jobs[0].command == ""
    assert result.jobs[0].schedule == "0 0 * * *"


def test_line_number_tracked():
    raw = "\n*/5 * * * * /cmd1\n\n@daily /cmd2"
    result = parse_crontab(raw)
    assert result.jobs[0].line_number == 2
    assert result.jobs[1].line_number == 4


def test_raw_line_preserved():
    line = "  */5 * * * * /usr/bin/backup  "
    result = parse_crontab(line)
    assert result.jobs[0].raw_line == line


# ---------------------------------------------------------------------------
# @aliases
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "alias",
    ["@yearly", "@annually", "@monthly", "@weekly", "@daily", "@midnight", "@hourly"],
)
def test_alias_enabled(alias):
    result = parse_crontab(f"{alias} /usr/bin/task")
    assert len(result.jobs) == 1
    assert result.jobs[0].schedule == alias
    assert result.jobs[0].command == "/usr/bin/task"
    assert result.jobs[0].enabled is True
    assert result.jobs[0].error is None


def test_alias_reboot():
    result = parse_crontab("@reboot /usr/bin/startup")
    assert result.jobs[0].schedule == "@reboot"
    assert result.jobs[0].error is None  # @reboot is valid (not time-based)


def test_alias_case_insensitive():
    result = parse_crontab("@Daily /usr/bin/task")
    assert result.jobs[0].schedule == "@daily"


def test_word_starting_with_alias_name_not_matched():
    # "daily" without '@' must NOT be treated as an alias
    result = parse_crontab("# daily /usr/bin/task")
    assert result.jobs == []  # looks like a comment, not a cron line


# ---------------------------------------------------------------------------
# Disabled jobs (commented-out cron lines)
# ---------------------------------------------------------------------------


def test_disabled_standard_job():
    result = parse_crontab("# */5 * * * * /usr/bin/backup")
    assert len(result.jobs) == 1
    job = result.jobs[0]
    assert job.enabled is False
    assert job.schedule == "*/5 * * * *"
    assert job.command == "/usr/bin/backup"


def test_disabled_alias_job():
    result = parse_crontab("# @daily /usr/bin/cleanup")
    assert len(result.jobs) == 1
    assert result.jobs[0].enabled is False
    assert result.jobs[0].schedule == "@daily"


def test_double_hash_disabled_job():
    result = parse_crontab("## */5 * * * * /cmd")
    assert len(result.jobs) == 1
    assert result.jobs[0].enabled is False


# ---------------------------------------------------------------------------
# Invalid schedules
# ---------------------------------------------------------------------------


def test_invalid_schedule_kept_with_error():
    result = parse_crontab("99 * * * * /usr/bin/backup")
    assert len(result.jobs) == 1
    assert result.jobs[0].error is not None
    assert result.jobs[0].enabled is True


def test_invalid_schedule_produces_warning():
    result = parse_crontab("99 * * * * /usr/bin/backup")
    assert len(result.warnings) == 1


def test_unrecognised_line_skipped_with_warning():
    # A line with fewer than 5 fields cannot be a cron job
    result = parse_crontab("not enough")
    assert result.jobs == []
    assert len(result.warnings) == 1


# ---------------------------------------------------------------------------
# Mixed real-world crontab
# ---------------------------------------------------------------------------


def test_realistic_crontab():
    raw = """\
# /etc/crontab: system-wide crontab
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# m h  dom mon dow   command
17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly
25 6    * * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )
# @weekly /usr/bin/disabled-task
@reboot /usr/bin/startup-script
# just a prose comment
"""
    result = parse_crontab(raw)

    assert len(result.jobs) == 4

    # Hourly
    assert result.jobs[0].schedule == "17 * * * *"
    assert result.jobs[0].enabled is True

    # Daily (with 'root' as part of command since we use 5-field parsing)
    assert result.jobs[1].schedule == "25 6 * * *"
    assert result.jobs[1].enabled is True

    # Disabled @weekly
    assert result.jobs[2].schedule == "@weekly"
    assert result.jobs[2].enabled is False

    # @reboot
    assert result.jobs[3].schedule == "@reboot"
    assert result.jobs[3].enabled is True
