import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import calendar


sys.path.insert(0, str(Path(__file__).parent))
import sync_ltna  # noqa: E402


def report_html(month="2026-09", *, total=70, previous=65, current_light="green", count_green=1, rg="3"):
    year, number = map(int, month.split("-"))
    first_month = sync_ltna.shift_month(month, -5)
    start = f"{first_month}-01"
    end = f"{year:04d}-{number:02d}-{calendar.monthrange(year, number)[1]:02d}"
    label = sync_ltna.LIGHT_LABELS[sync_ltna.SOURCE_LIGHTS[current_light]]
    if previous is None:
        previous_text = "—"
        change = "新進"
    else:
        previous_text = str(previous)
        delta = total - previous
        change = "—" if delta == 0 else f"{'▲' if delta > 0 else '▼'} {delta:+d}"
    green = count_green
    amber = 1 if current_light == "yellow" else 0
    red = 1 if current_light == "red" else 0
    grey = 1 if current_light == "black" else 0
    chapter_values = [
        ("分會規模", "1", "1"),
        ("會員增長(6個月)", "1", "1"),
        ("保留率 %", "0", "0"),
        ("引薦數/週", "0.5", "0.6"),
        ("來賓數/週", "1.0", "1.5"),
        ("轉換率 %", "25", "30"),
        ("缺席率 %", "2", "1.5"),
        ("分會得分", "60", "65"),
    ]
    chapter_rows = "".join(
        f"<tr><td>{label_text}</td><td>{old}</td><td>→</td><td><b>{new}</b></td><td>—</td></tr>"
        for label_text, old, new in chapter_values
    )
    return f"""<!doctype html><html><head>
<title>華都更 LTnA 紅綠燈 | {year} 年 {number} 月</title>
<script>const ignored = '<title>fake 1999 年 1 月</title><tbody id="tb"></tbody>';</script>
</head><body>
<div class="sub">Hua Urban+ ・ 1 位會員 ・ {year} 年 {number} 月</div>
<div class="period">統計期間 {start} - {end} (6個月)</div>
<div class="stat"><div class="n green">{green}</div><div class="l">綠燈</div></div>
<div class="stat"><div class="n yellow">{amber}</div><div class="l">黃燈</div></div>
<div class="stat"><div class="n red">{red}</div><div class="l">紅燈</div></div>
<div class="stat"><div class="n black">{grey}</div><div class="l">黑燈</div></div>
<div class="card-h">分會指標（上月 → 本月）</div><table><tbody>{chapter_rows}</tbody></table>
<table><tbody id="tb"><tr data-l="{current_light}">
<td>1</td><td><b>測試會員 Member One</b></td><td><span>{label}</span></td>
<td><b>{total}</b></td><td>{previous_text}</td><td>{change}</td>
<td>{rg}</td><td>2</td><td>3</td><td>4</td>
</tr></tbody></table></body></html>"""


def source_record(month="2026-09", **kwargs):
    ym = month.replace("-", "")
    return sync_ltna.parse_report(report_html(month, **kwargs), month, sync_ltna.SOURCE_TEMPLATE.format(ym=ym))


class ParseReportTests(unittest.TestCase):
    def test_parses_official_fields_and_normalizes_source_lamps(self):
        record = source_record()
        self.assertEqual(record["month"], "2026-09")
        self.assertEqual(record["range"], "2026-04-01 – 2026-09-30")
        self.assertEqual(record["chapter"], {
            "size": 1, "growth": 1, "retention": 0, "ref": 0.6, "vis": 1.5,
            "conv": 30, "absent": 1.5, "score": 65, "prevScore": 60,
        })
        self.assertEqual(record["counts"], {"green": 1, "amber": 0, "red": 0, "grey": 0})
        self.assertEqual(record["members"][0], {
            "no": 1, "name": "測試會員 Member One", "total": 70, "previousTotal": 65,
            "light": "green", "RG": 3, "V": 2, "O2O": 3, "CEU": 4,
        })

    def test_new_member_has_null_previous_total(self):
        record = source_record(previous=None)
        self.assertIsNone(record["members"][0]["previousTotal"])

    def test_rejects_wrong_title_period_or_count(self):
        with self.assertRaises(sync_ltna.ReportError):
            sync_ltna.parse_report(report_html().replace("2026 年 9 月", "2026 年 8 月", 1), "2026-09")
        with self.assertRaises(sync_ltna.ReportError):
            sync_ltna.parse_report(report_html().replace("2026-09-30", "2026-08-31"), "2026-09")
        with self.assertRaises(sync_ltna.ReportError):
            sync_ltna.parse_report(report_html().replace('class="n green">1', 'class="n green">0'), "2026-09")

    def test_rejects_score_lamp_conflict_and_missing_raw_metrics(self):
        with self.assertRaises(sync_ltna.ReportError):
            source_record(total=65, previous=60)
        with self.assertRaises(sync_ltna.ReportError):
            sync_ltna.parse_report(report_html().replace("<td>3</td><td>2</td>", "<td></td><td>2</td>"), "2026-09")

    def test_month_window_crosses_year_boundary(self):
        self.assertEqual(sync_ltna.month_window("2026-01"), ("2026-01", "2025-12", "2025-11"))
        self.assertEqual(sync_ltna.shift_month("2025-01", -1), "2024-12")
        utc_time = datetime(2025, 12, 31, 16, 30, tzinfo=timezone.utc)
        self.assertEqual(sync_ltna.previous_month_taipei(utc_time), "2025-12")


class SyncMonthlyTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.path = Path(self.tempdir.name) / "monthly.json"
        self.fixed_time = datetime(2026, 10, 13, 1, 2, 3, tzinfo=timezone.utc)

    def tearDown(self):
        self.tempdir.cleanup()

    def write_existing(self, records):
        payload = {"updatedAt": "2026-10-01T00:00:00.000Z", "checkedAt": "2026-10-01T00:00:00.000Z", "months": records}
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def test_imports_target_and_two_prior_months_sorted_on_year_rollover(self):
        reports = {month: source_record(month) for month in ("2026-01", "2025-12", "2025-11")}
        result = sync_ltna.sync_monthly("2026-01", self.path, fetcher=reports.__getitem__, now=self.fixed_time)
        self.assertTrue(result.latest_available)
        self.assertTrue(result.changed)
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual([item["month"] for item in payload["months"]], ["2026-01", "2025-12", "2025-11"])

    def test_delayed_target_keeps_known_target_and_writes_valid_older_sources(self):
        known_target = source_record("2026-09", total=75, previous=70)
        self.write_existing([known_target])
        reports = {month: source_record(month) for month in ("2026-08", "2026-07")}

        def fetcher(month):
            if month == "2026-09":
                raise OSError("404 Not Found")
            return reports[month]

        result = sync_ltna.sync_monthly("2026-09", self.path, fetcher=fetcher, now=self.fixed_time)
        self.assertFalse(result.latest_available)
        self.assertTrue(result.changed)
        self.assertIn("2026-09", result.failures)
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual([item["month"] for item in payload["months"]], ["2026-09", "2026-08", "2026-07"])
        self.assertEqual(payload["months"][0], known_target)

    def test_bad_or_unavailable_sources_never_overwrite_existing_valid_stats(self):
        original = source_record("2026-09", total=80, previous=75)
        self.write_existing([original])
        before = self.path.read_bytes()

        def fetcher(month):
            raise OSError("source unavailable")

        result = sync_ltna.sync_monthly("2026-09", self.path, fetcher=fetcher, now=self.fixed_time)
        self.assertFalse(result.latest_available)
        self.assertFalse(result.changed)
        self.assertEqual(self.path.read_bytes(), before)

    def test_unavailable_target_retains_two_prior_calendar_months_from_newest_available(self):
        june = source_record("2026-06")
        self.write_existing([june])
        reports = {month: source_record(month) for month in ("2026-08", "2026-07")}

        def fetcher(month):
            if month == "2026-09":
                raise OSError("delayed")
            return reports[month]

        result = sync_ltna.sync_monthly("2026-09", self.path, fetcher=fetcher, now=self.fixed_time)
        self.assertFalse(result.latest_available)
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual([item["month"] for item in payload["months"]], ["2026-08", "2026-07", "2026-06"])

    def test_cli_returns_failure_for_a_delayed_latest_target(self):
        result = sync_ltna.SyncResult(
            target="2026-09", imported=("2026-07", "2026-08"), failures={"2026-09": "OSError: 404"},
            latest_available=False, changed=False, output=self.path,
        )
        with patch.object(sync_ltna, "sync_monthly", return_value=result):
            self.assertEqual(sync_ltna.main(["--month", "2026-09", "--output", str(self.path)]), 1)

    def test_identical_stats_do_not_change_file_or_timestamps(self):
        records = [source_record(month) for month in ("2026-09", "2026-08", "2026-07")]
        self.write_existing(records)
        before = self.path.read_bytes()
        results = {record["month"]: record for record in records}
        result = sync_ltna.sync_monthly("2026-09", self.path, fetcher=results.__getitem__, now=self.fixed_time)
        self.assertTrue(result.latest_available)
        self.assertFalse(result.changed)
        self.assertEqual(self.path.read_bytes(), before)

    def test_ascending_existing_file_migrates_to_descending_month_order(self):
        records = [source_record(month) for month in ("2026-07", "2026-08", "2026-09")]
        self.write_existing(records)
        results = {record["month"]: record for record in records}
        result = sync_ltna.sync_monthly("2026-09", self.path, fetcher=results.__getitem__, now=self.fixed_time)
        self.assertTrue(result.changed)
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual([item["month"] for item in payload["months"]], ["2026-09", "2026-08", "2026-07"])

    def test_invalid_existing_json_is_left_untouched(self):
        self.path.write_text("{broken", encoding="utf-8")
        before = self.path.read_bytes()
        with self.assertRaises(sync_ltna.ExistingDataError):
            sync_ltna.sync_monthly("2026-09", self.path, fetcher=lambda month: source_record(month))
        self.assertEqual(self.path.read_bytes(), before)

    def test_nonfinite_existing_stat_is_rejected_before_merge(self):
        record = source_record("2026-09")
        record["chapter"]["ref"] = float("nan")
        self.write_existing([record])
        before = self.path.read_bytes()
        with self.assertRaises(sync_ltna.ExistingDataError):
            sync_ltna.sync_monthly("2026-09", self.path, fetcher=lambda month: source_record(month))
        self.assertEqual(self.path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
