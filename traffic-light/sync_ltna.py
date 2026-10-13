#!/usr/bin/env python3
"""Import official monthly LTnA reports into traffic-light/monthly.json.

The importer reads static HTML with the standard-library HTMLParser. It never
executes JavaScript from the source page.
"""

from __future__ import annotations

import argparse
import calendar
from dataclasses import dataclass
from datetime import date, datetime, timezone
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from typing import Callable
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


SOURCE_TEMPLATE = "https://bninwb.autolab.cloud/{ym}/hua-urban.html"
DEFAULT_OUTPUT = Path(__file__).with_name("monthly.json")
MAX_SOURCE_BYTES = 3 * 1024 * 1024
SOURCE_TIMEOUT_SECONDS = 30
LIGHT_FIELDS = ("green", "amber", "red", "grey")
SOURCE_LIGHTS = {
    "green": "green",
    "yellow": "amber",
    "red": "red",
    "black": "grey",
}
LIGHT_LABELS = {
    "green": "綠燈",
    "amber": "黃燈",
    "red": "紅燈",
    "grey": "黑燈",
}
CHAPTER_LABELS = {
    "分會規模": "size",
    "會員增長(6個月)": "growth",
    "保留率%": "retention",
    "引薦數/週": "ref",
    "來賓數/週": "vis",
    "轉換率%": "conv",
    "缺席率%": "absent",
    "分會得分": "score",
}
CHAPTER_FIELDS = ("size", "growth", "retention", "ref", "vis", "conv", "absent", "score", "prevScore")
MEMBER_FIELDS = ("no", "name", "total", "previousTotal", "light", "RG", "V", "O2O", "CEU")


class ReportError(ValueError):
    """The downloaded page is not a consistent monthly LTnA report."""


class ExistingDataError(ValueError):
    """The existing data file cannot safely be merged or replaced."""


@dataclass(frozen=True)
class SyncResult:
    target: str
    imported: tuple[str, ...]
    failures: dict[str, str]
    latest_available: bool
    changed: bool
    output: Path


def _clean_text(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def _month_index(month: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d{4})-(\d{2})", month)
    if not match:
        raise ValueError("month must use YYYY-MM format")
    year, number = map(int, match.groups())
    if number < 1 or number > 12:
        raise ValueError("month must be between 01 and 12")
    return year, number


def shift_month(month: str, delta: int) -> str:
    """Return a YYYY-MM month offset by delta calendar months."""
    year, number = _month_index(month)
    index = year * 12 + number - 1 + delta
    shifted_year, zero_based_month = divmod(index, 12)
    if shifted_year < 1 or shifted_year > 9999:
        raise ValueError("month offset is outside the supported calendar")
    return f"{shifted_year:04d}-{zero_based_month + 1:02d}"


def month_window(target: str) -> tuple[str, str, str]:
    """Return target and its two immediately preceding calendar months."""
    _month_index(target)
    return target, shift_month(target, -1), shift_month(target, -2)


def previous_month_taipei(now: datetime | None = None) -> str:
    if now is None:
        now = datetime.now(ZoneInfo("Asia/Taipei"))
    elif now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo("Asia/Taipei"))
    else:
        now = now.astimezone(ZoneInfo("Asia/Taipei"))
    return shift_month(f"{now.year:04d}-{now.month:02d}", -1)


def _numeric(value: str, *, field: str) -> int | float:
    text = _clean_text(value).replace(",", "")
    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?", text):
        raise ReportError(f"{field} is not a numeric source value: {value!r}")
    number = float(text) if "." in text else int(text)
    if isinstance(number, float):
        if not math.isfinite(number):
            raise ReportError(f"{field} is outside the supported numeric range")
        if number.is_integer():
            return int(number)
    return number


def _int_value(value: str, *, field: str, minimum: int = 0, maximum: int | None = None) -> int:
    number = _numeric(value, field=field)
    if not isinstance(number, int):
        raise ReportError(f"{field} must be a whole number")
    if number < minimum or (maximum is not None and number > maximum):
        bounds = f"at least {minimum}" + (f" and at most {maximum}" if maximum is not None else "")
        raise ReportError(f"{field} must be {bounds}")
    return number


def light_for_score(score: int) -> str:
    if score >= 70:
        return "green"
    if score >= 50:
        return "amber"
    if score >= 30:
        return "red"
    return "grey"


class _ReportParser(HTMLParser):
    """Capture report fields and table cells without interpreting scripts."""

    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[dict] = []
        self.title: list[str] = []
        self.subtitle: list[str] = []
        self.period: list[str] = []
        self.stats: list[dict[str, str]] = []
        self.member_rows: list[dict] = []
        self.chapter_rows: list[list[str]] = []
        self.member_active = False
        self.member_row: dict | None = None
        self.member_cell: list[str] | None = None
        self.chapter_pending = False
        self.chapter_table_active = False
        self.chapter_row: list[str] | None = None
        self.chapter_cell: list[str] | None = None
        self._chapter_table_depth = 0

    @staticmethod
    def _classes(attrs: dict[str, str | None]) -> set[str]:
        return set((attrs.get("class") or "").split())

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = dict(attrs_list)
        classes = self._classes(attrs)
        node = {"tag": tag, "attrs": attrs, "classes": classes}

        if tag == "title":
            node["kind"] = "title"
        if "sub" in classes:
            node["kind"] = "subtitle"
        if "period" in classes:
            node["kind"] = "period"
        if "stat" in classes:
            node["stat"] = {"number": [], "label": []}
        if "card-h" in classes:
            node["kind"] = "card_header"
            node["text"] = []

        if tag == "tbody" and attrs.get("id") == "tb":
            self.member_active = True
        if self.member_active and tag == "tr":
            self.member_row = {"light": attrs.get("data-l", ""), "cells": []}
        if self.member_row is not None and tag == "td":
            self.member_cell = []

        if tag == "table" and self.chapter_pending and not self.chapter_table_active:
            self.chapter_table_active = True
            self._chapter_table_depth = 1
            self.chapter_pending = False
        elif self.chapter_table_active and tag == "table":
            self._chapter_table_depth += 1
        if self.chapter_table_active and tag == "tr":
            self.chapter_row = []
        if self.chapter_row is not None and tag == "td":
            self.chapter_cell = []

        self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in self.VOID_TAGS:
            self.handle_starttag(tag, attrs)
            self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if any(node["tag"] == "script" for node in self.stack):
            return
        for node in self.stack:
            kind = node.get("kind")
            if kind == "title":
                self.title.append(data)
            elif kind == "subtitle":
                self.subtitle.append(data)
            elif kind == "period":
                self.period.append(data)
            elif kind == "card_header":
                node["text"].append(data)
        stat = None
        for node in reversed(self.stack):
            stat = node.get("stat")
            if stat is not None:
                break
        if stat is not None:
            stat_index = next(i for i, item in enumerate(self.stack) if item.get("stat") is stat)
            for node in self.stack[stat_index + 1 :]:
                if "n" in node.get("classes", set()):
                    stat["number"].append(data)
                    break
                if "l" in node.get("classes", set()):
                    stat["label"].append(data)
                    break
        if self.member_cell is not None:
            self.member_cell.append(data)
        if self.chapter_cell is not None:
            self.chapter_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        index = next((i for i in range(len(self.stack) - 1, -1, -1) if self.stack[i]["tag"] == tag), None)
        if index is None:
            return
        closing = self.stack[index:]
        node = self.stack[index]

        if tag == "td":
            text = _clean_text("".join(self.member_cell or []))
            if self.member_cell is not None and self.member_row is not None:
                self.member_row["cells"].append(text)
                self.member_cell = None
            chapter_text = _clean_text("".join(self.chapter_cell or []))
            if self.chapter_cell is not None and self.chapter_row is not None:
                self.chapter_row.append(chapter_text)
                self.chapter_cell = None
        if tag == "tr":
            if self.member_row is not None:
                self.member_rows.append(self.member_row)
                self.member_row = None
            if self.chapter_row is not None:
                self.chapter_rows.append(self.chapter_row)
                self.chapter_row = None
        if tag == "tbody" and node["attrs"].get("id") == "tb":
            self.member_active = False
        if tag == "table" and self.chapter_table_active:
            self._chapter_table_depth -= 1
            if self._chapter_table_depth == 0:
                self.chapter_table_active = False
        if node.get("stat") is not None:
            self.stats.append({key: _clean_text("".join(value)) for key, value in node["stat"].items()})
        for closed in closing:
            if closed.get("kind") == "card_header":
                if "分會指標" in _clean_text("".join(closed["text"])):
                    self.chapter_pending = True
        del self.stack[index:]

    def close(self) -> None:
        super().close()
        if self.member_active or self.member_row is not None or self.chapter_table_active:
            raise ReportError("source HTML ended inside a report table")


def _expected_dates(month: str) -> tuple[str, str]:
    year, number = _month_index(month)
    start_month = shift_month(month, -5)
    start_year, start_number = _month_index(start_month)
    start = date(start_year, start_number, 1)
    end = date(year, number, calendar.monthrange(year, number)[1])
    return start.isoformat(), end.isoformat()


def _parse_member_rows(rows: list[dict], expected_count: int) -> tuple[list[dict], dict[str, int]]:
    if not rows:
        raise ReportError("member table #tb has no rows")
    if len(rows) != expected_count:
        raise ReportError(f"subtitle says {expected_count} members but #tb has {len(rows)} rows")
    members = []
    computed_counts = {key: 0 for key in LIGHT_FIELDS}
    expected_labels = {value: key for key, value in LIGHT_LABELS.items()}
    for position, row in enumerate(rows, start=1):
        cells = row["cells"]
        if len(cells) != 10:
            raise ReportError(f"member row {position} has {len(cells)} cells; expected 10")
        number = _int_value(cells[0], field=f"member row {position} rank", minimum=1)
        if number != position:
            raise ReportError(f"member table rank {number} appears at position {position}")
        name = _clean_text(cells[1])
        if not name:
            raise ReportError(f"member row {position} has an empty name")
        source_light = row["light"].lower()
        light = SOURCE_LIGHTS.get(source_light)
        if light is None:
            raise ReportError(f"member row {position} has an unknown lamp class {source_light!r}")
        total = _int_value(cells[3], field=f"{name} current score", maximum=100)
        if light_for_score(total) != light:
            raise ReportError(f"{name} score {total} conflicts with lamp {source_light}")
        if cells[2] not in expected_labels or expected_labels[cells[2]] != light:
            raise ReportError(f"{name} lamp label conflicts with its lamp class")
        previous_text = _clean_text(cells[4])
        change_text = _clean_text(cells[5])
        if previous_text in ("", "—", "–", "-"):
            if "新進" not in change_text:
                raise ReportError(f"{name} has no previous score but is not marked as new")
            previous_total = None
        else:
            if "新進" in change_text:
                raise ReportError(f"{name} is marked new but has a previous score")
            previous_total = _int_value(previous_text, field=f"{name} previous score", maximum=100)
            match = re.search(r"([+-]\s*\d+)", change_text)
            if match:
                reported_change = int(match.group(1).replace(" ", ""))
                if total - previous_total != reported_change:
                    raise ReportError(f"{name} displayed change conflicts with current and previous scores")
            elif total != previous_total:
                raise ReportError(f"{name} displayed no change despite different scores")
        member = {
            "no": number,
            "name": name,
            "total": total,
            "previousTotal": previous_total,
            "light": light,
            "RG": _int_value(cells[6], field=f"{name} RG"),
            "V": _int_value(cells[7], field=f"{name} V"),
            "O2O": _int_value(cells[8], field=f"{name} O2O"),
            "CEU": _int_value(cells[9], field=f"{name} CEU"),
        }
        members.append(member)
        computed_counts[light] += 1
    return members, computed_counts


def _parse_chapter_rows(rows: list[list[str]]) -> dict:
    fields: dict[str, int | float] = {}
    for row in rows:
        if len(row) != 5:
            continue
        label = re.sub(r"\s+", "", row[0])
        key = CHAPTER_LABELS.get(label)
        if key is None:
            continue
        if key in fields:
            raise ReportError(f"chapter metrics table repeats {row[0]!r}")
        previous = _numeric(row[1], field=f"chapter {key} previous value")
        current = _numeric(row[3], field=f"chapter {key} current value")
        if key in ("size", "growth", "score") and (not isinstance(previous, int) or not isinstance(current, int)):
            raise ReportError(f"chapter {key} values must be whole numbers")
        fields[key] = current
        if key == "score":
            fields["prevScore"] = previous
    missing = set(CHAPTER_FIELDS) - fields.keys()
    if missing:
        raise ReportError("chapter metrics table is missing: " + ", ".join(sorted(missing)))
    fields["size"] = int(fields["size"])
    fields["growth"] = int(fields["growth"])
    fields["score"] = int(fields["score"])
    fields["prevScore"] = int(fields["prevScore"])
    return fields


def parse_report(html: str, month: str, source: str | None = None) -> dict:
    """Parse and validate one official report, returning the monthly schema."""
    year, number = _month_index(month)
    if source is None:
        source = SOURCE_TEMPLATE.format(ym=f"{year:04d}{number:02d}")
    parser = _ReportParser()
    parser.feed(html)
    parser.close()

    title = _clean_text("".join(parser.title))
    title_match = re.search(r"LTnA\s*紅綠燈\s*[|｜]\s*(\d{4})\s*年\s*(\d{1,2})\s*月", title)
    if not title_match or tuple(map(int, title_match.groups())) != (year, number):
        raise ReportError(f"title does not identify requested month {month}: {title!r}")

    subtitle = _clean_text("".join(parser.subtitle))
    subtitle_match = re.search(r"(\d+)\s*位會員.*?(\d{4})\s*年\s*(\d{1,2})\s*月", subtitle)
    if not subtitle_match or tuple(map(int, subtitle_match.groups()[1:])) != (year, number):
        raise ReportError(f"subtitle does not identify requested month {month}: {subtitle!r}")
    expected_count = int(subtitle_match.group(1))

    period_text = _clean_text("".join(parser.period))
    period_match = re.search(r"(\d{4}-\d{2}-\d{2})\s*[-–—至]\s*(\d{4}-\d{2}-\d{2})", period_text)
    if not period_match:
        raise ReportError(f"period range is missing or invalid: {period_text!r}")
    actual_start, actual_end = period_match.groups()
    try:
        date.fromisoformat(actual_start)
        date.fromisoformat(actual_end)
    except ValueError as exc:
        raise ReportError(f"period contains an invalid calendar date: {exc}") from exc
    expected_start, expected_end = _expected_dates(month)
    if (actual_start, actual_end) != (expected_start, expected_end):
        raise ReportError(
            f"period for {month} is {actual_start} – {actual_end}; expected {expected_start} – {expected_end}"
        )

    members, calculated_counts = _parse_member_rows(parser.member_rows, expected_count)
    chapter = _parse_chapter_rows(parser.chapter_rows)
    if chapter["size"] != len(members):
        raise ReportError(f"chapter size {chapter['size']} conflicts with {len(members)} member rows")

    counts = {key: 0 for key in LIGHT_FIELDS}
    if len(parser.stats) != 4:
        raise ReportError(f"expected 4 light count stats; found {len(parser.stats)}")
    seen_stat_lights = set()
    for item in parser.stats:
        label = _clean_text(item.get("label", ""))
        light = {value: key for key, value in LIGHT_LABELS.items()}.get(label)
        if light is None or light in seen_stat_lights:
            raise ReportError(f"unknown or duplicate light count label: {label!r}")
        seen_stat_lights.add(light)
        count = _int_value(item.get("number", ""), field=f"{label} count")
        counts[light] = count
    if sum(counts.values()) != len(members):
        raise ReportError("light count totals do not match the member row count")
    if counts != calculated_counts:
        raise ReportError(f"light count stats do not match member lamps: {counts} != {calculated_counts}")

    return {
        "month": month,
        "period": f"{year} 年 {number} 月",
        "range": f"{expected_start} – {expected_end}",
        "source": source,
        "chapter": chapter,
        "counts": counts,
        "members": members,
    }


def fetch_report(month: str, timeout: int = SOURCE_TIMEOUT_SECONDS) -> dict:
    year, number = _month_index(month)
    ym = f"{year:04d}{number:02d}"
    url = SOURCE_TEMPLATE.format(ym=ym)
    request = Request(url, headers={"User-Agent": "HuaUrban-LTnA-import/1.0 (+https://bninwb.autolab.cloud/)"})
    with urlopen(request, timeout=timeout) as response:
        final_url = urlparse(response.geturl())
        if final_url.scheme != "https" or final_url.hostname != "bninwb.autolab.cloud":
            raise ReportError(f"source redirected outside the official report host: {response.geturl()}")
        content_type = response.headers.get_content_type()
        if content_type != "text/html":
            raise ReportError(f"source returned {content_type}, expected text/html")
        data = response.read(MAX_SOURCE_BYTES + 1)
        if len(data) > MAX_SOURCE_BYTES:
            raise ReportError("source HTML exceeds the 3 MiB safety limit")
        charset = response.headers.get_content_charset() or "utf-8"
    try:
        html = data.decode(charset)
    except (LookupError, UnicodeDecodeError) as exc:
        raise ReportError(f"could not decode official report using {charset}: {exc}") from exc
    return parse_report(html, month, source=url)


def _validate_existing_record(record: object) -> dict:
    if not isinstance(record, dict):
        raise ExistingDataError("monthly entries must be objects")
    try:
        month = record["month"]
        year, month_number = _month_index(month)
        expected_start, expected_end = _expected_dates(month)
        if not isinstance(record["period"], str) or not isinstance(record["range"], str):
            raise ValueError("period and range must be strings")
        if record["period"] != f"{year} 年 {month_number} 月":
            raise ValueError("period does not agree with month")
        if record["range"] != f"{expected_start} – {expected_end}":
            raise ValueError("range does not agree with month")
        expected_source = SOURCE_TEMPLATE.format(ym=f"{year:04d}{month_number:02d}")
        if record["source"] != expected_source:
            raise ValueError("source does not match the official monthly report URL")
        chapter = record["chapter"]
        if not isinstance(chapter, dict) or set(chapter) != set(CHAPTER_FIELDS):
            raise ValueError("chapter fields do not match the monthly schema")
        for key, value in chapter.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"chapter {key} must be numeric")
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(f"chapter {key} must be finite")
        for key in ("size", "growth", "score", "prevScore"):
            if not isinstance(chapter[key], int):
                raise ValueError(f"chapter {key} must be a whole number")
        if chapter["size"] < 0 or not 0 <= chapter["score"] <= 100 or not 0 <= chapter["prevScore"] <= 100:
            raise ValueError("chapter size or score is outside its valid range")
        counts = record["counts"]
        if not isinstance(counts, dict) or set(counts) != set(LIGHT_FIELDS):
            raise ValueError("count fields do not match the monthly schema")
        if any(isinstance(counts[key], bool) or not isinstance(counts[key], int) or counts[key] < 0 for key in LIGHT_FIELDS):
            raise ValueError("counts must be nonnegative integers")
        members = record["members"]
        if not isinstance(members, list):
            raise ValueError("members must be a list")
        calculated_counts = {key: 0 for key in LIGHT_FIELDS}
        for position, member in enumerate(members, start=1):
            if not isinstance(member, dict) or set(member) != set(MEMBER_FIELDS):
                raise ValueError("member fields do not match the monthly schema")
            if member["no"] != position or isinstance(member["no"], bool):
                raise ValueError("member ranks must be consecutive and start at 1")
            if not isinstance(member["name"], str) or not member["name"].strip():
                raise ValueError("member names must be nonempty strings")
            total = member["total"]
            previous_total = member["previousTotal"]
            if isinstance(total, bool) or not isinstance(total, int) or not 0 <= total <= 100:
                raise ValueError("member totals must be whole scores from 0 through 100")
            if previous_total is not None and (
                isinstance(previous_total, bool)
                or not isinstance(previous_total, int)
                or not 0 <= previous_total <= 100
            ):
                raise ValueError("previous member totals must be null or whole scores from 0 through 100")
            light = member["light"]
            if light not in LIGHT_FIELDS or light_for_score(total) != light:
                raise ValueError("member light does not agree with its total score")
            calculated_counts[light] += 1
            for key in ("RG", "V", "O2O", "CEU"):
                value = member[key]
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    raise ValueError(f"member {key} must be a nonnegative integer")
        if sum(counts.values()) != len(members):
            raise ValueError("light counts do not sum to the number of members")
        if calculated_counts != counts:
            raise ValueError("light counts do not match member lamps")
        if chapter["size"] != len(members):
            raise ValueError("chapter size does not match member rows")
        return record
    except (KeyError, TypeError, ValueError) as exc:
        if isinstance(exc, ExistingDataError):
            raise
        raise ExistingDataError(f"invalid existing monthly entry: {exc}") from exc


def _load_existing(path: Path) -> dict:
    if not path.exists():
        return {"updatedAt": None, "checkedAt": None, "months": []}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExistingDataError(f"cannot read existing monthly data safely: {exc}") from exc
    if not isinstance(value, dict) or not isinstance(value.get("months"), list):
        raise ExistingDataError("existing monthly data must contain a months array")
    if not isinstance(value.get("updatedAt"), str) or not isinstance(value.get("checkedAt"), str):
        raise ExistingDataError("existing monthly data must contain updatedAt and checkedAt timestamps")
    entries = [_validate_existing_record(item) for item in value["months"]]
    month_names = [item["month"] for item in entries]
    if len(set(month_names)) != len(month_names):
        raise ExistingDataError("existing monthly data contains duplicate months")
    # Accept older files in any order and normalize them during the next write.
    return {"updatedAt": value["updatedAt"], "checkedAt": value["checkedAt"], "months": entries}


def _write_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def sync_monthly(
    target: str,
    output: Path = DEFAULT_OUTPUT,
    fetcher: Callable[[str], dict] = fetch_report,
    now: datetime | None = None,
) -> SyncResult:
    _month_index(target)
    path = Path(output)
    existing = _load_existing(path)
    known = {item["month"]: item for item in existing["months"]}
    imported: dict[str, dict] = {}
    failures: dict[str, str] = {}
    for month in month_window(target):
        try:
            report = fetcher(month)
            report = _validate_existing_record(report)
            if report["month"] != month:
                raise ReportError(f"source for {month} returned report for {report['month']}")
            imported[month] = report
        except Exception as exc:  # transport and source-format failures are recorded per month
            failures[month] = f"{type(exc).__name__}: {exc}"

    merged = dict(known)
    merged.update(imported)
    available_not_after_target = [month for month in merged if month <= target]
    changed = False
    if available_not_after_target:
        newest_available = max(available_not_after_target)
        oldest_retained = shift_month(newest_available, -2)
        retained = [
            merged[month]
            for month in sorted(merged, reverse=True)
            if oldest_retained <= month <= newest_available
        ]
        old_records = existing["months"]
        changed = retained != old_records
        if changed:
            checked_at = now or datetime.now(timezone.utc)
            if checked_at.tzinfo is None:
                checked_at = checked_at.replace(tzinfo=timezone.utc)
            timestamp = checked_at.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            payload = {"updatedAt": timestamp, "checkedAt": timestamp, "months": retained}
            _write_atomic(path, payload)
    elif imported:
        # The only successful imports are later than a requested historical target.
        raise ReportError(f"no available source month is on or before requested target {target}")

    return SyncResult(
        target=target,
        imported=tuple(sorted(imported)),
        failures=failures,
        latest_available=target in imported,
        changed=changed,
        output=path,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import official monthly LTnA report data")
    parser.add_argument("--month", help="deterministic target month in YYYY-MM format; defaults to the previous Asia/Taipei month")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="monthly JSON output path")
    args = parser.parse_args(argv)
    try:
        target = args.month or previous_month_taipei()
        _month_index(target)
        result = sync_monthly(target, args.output)
    except (ReportError, ExistingDataError, OSError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1

    if result.changed:
        print(f"Updated {result.output} with months: {', '.join(item['month'] for item in _load_existing(result.output)['months'])}")
    else:
        print(f"No monthly data changes for target {target}; preserved {result.output}")
    for month, message in sorted(result.failures.items()):
        level = "error" if month == target else "warning"
        print(f"::{level}::Could not import source month {month}: {message}", file=sys.stderr)
    if not result.latest_available:
        reason = result.failures.get(target, "source was not imported")
        print(
            f"::error::Latest target {target} is unavailable ({reason}); valid existing and older monthly data was preserved.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
