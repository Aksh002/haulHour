from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from planner.domain.enums import DutyStatus
from planner.domain.models import ScheduleEvent


def build_daily_logs(events: list[ScheduleEvent], terminal_timezone: str, metadata: dict | None = None) -> list[dict]:
    if not events:
        return []
    zone = ZoneInfo(terminal_timezone)
    metadata = metadata or {}
    first = events[0].start_at.astimezone(zone)
    last = events[-1].end_at.astimezone(zone)
    current_date = first.date()
    final_date = (last - timedelta(microseconds=1)).date()
    logs: list[dict] = []

    while current_date <= final_date:
        day_start = datetime.combine(current_date, time.min, tzinfo=zone)
        day_end = day_start + timedelta(days=1)
        segments: list[dict] = []
        cursor = day_start
        for event in events:
            start = event.start_at.astimezone(zone)
            end = event.end_at.astimezone(zone)
            clipped_start, clipped_end = max(start, day_start), min(end, day_end)
            if clipped_start >= clipped_end:
                continue
            if cursor < clipped_start:
                segments.append(_segment(cursor, clipped_start, day_start, DutyStatus.OFF_DUTY, None, "Unplanned time"))
            segments.append(_segment(clipped_start, clipped_end, day_start, event.duty_status, event.id, event.reason))
            cursor = max(cursor, clipped_end)
        if cursor < day_end:
            segments.append(_segment(cursor, day_end, day_start, DutyStatus.OFF_DUTY, None, "Unplanned time"))

        totals = defaultdict(int)
        for segment in segments:
            totals[segment["duty_status"]] += segment["end_minute"] - segment["start_minute"]
        for status in DutyStatus:
            totals[status.value] += 0
        if sum(totals.values()) != 1440:
            raise ValueError(f"Daily log for {current_date} does not total 24 hours")
        remarks = [
            {
                "minute": segment["start_minute"],
                "event_id": segment["event_id"],
                "text": segment["reason"],
            }
            for segment in segments
            if segment["event_id"]
        ]
        logs.append(
            {
                "date": current_date.isoformat(),
                "timezone": terminal_timezone,
                "segments": segments,
                "totals_minutes": dict(totals),
                "remarks": remarks,
                "metadata": metadata,
                "total_miles": round(sum(_event_miles_for_day(event, day_start, day_end) for event in events), 1),
            }
        )
        current_date += timedelta(days=1)
    return logs


def _segment(start, end, day_start, status, event_id, reason):
    return {
        "start_minute": round((start - day_start).total_seconds() / 60),
        "end_minute": round((end - day_start).total_seconds() / 60),
        "duty_status": status.value,
        "event_id": event_id,
        "reason": reason,
    }


def _event_miles_for_day(event, day_start, day_end):
    if event.duty_status != DutyStatus.DRIVING:
        return 0.0
    start, end = max(event.start_at, day_start), min(event.end_at, day_end)
    if start >= end:
        return 0.0
    fraction = (end - start).total_seconds() / (event.end_at - event.start_at).total_seconds()
    return (event.route_distance_end_miles - event.route_distance_start_miles) * fraction


def validate_daily_logs(logs: list[dict]) -> None:
    for log in logs:
        cursor = 0
        for segment in log["segments"]:
            if segment["start_minute"] != cursor or segment["end_minute"] <= cursor:
                raise ValueError("Daily log contains a gap, overlap, or invalid segment")
            cursor = segment["end_minute"]
        if cursor != 1440 or sum(log["totals_minutes"].values()) != 1440:
            raise ValueError("Daily log must cover exactly 1,440 minutes")
