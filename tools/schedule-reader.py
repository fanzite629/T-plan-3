"""Read the exported timetable offline. Python 3.8+, standard library only."""
import argparse
import datetime as dt
import json
from pathlib import Path
import sys


def query(data, date=None, week=None, course=None):
    if date is not None:
        parsed = dt.date.fromisoformat(date)
        if parsed.isoformat() != date:
            raise ValueError("日期格式必须为 YYYY-MM-DD")
    if week is not None and not 1 <= week <= data["term"]["totalWeeks"]:
        raise ValueError("教学周必须为 1–20")
    days = data["days"]
    if date is not None:
        days = [day for day in days if day["date"] == date]
    if week is not None:
        days = [day for day in days if day["teachingWeek"] == week]
    if course is not None:
        days = [dict(day,
                     formalCourses=[c for c in day["formalCourses"] if course.casefold() in (c["name"] + c.get("displayName", "")).casefold()],
                     optionalCourses=[c for c in day["optionalCourses"] if course.casefold() in c["name"].casefold()])
                for day in days]
        days = [day for day in days if day["formalCourses"] or day["optionalCourses"]]
    in_term = date is None or data["term"]["startDate"] <= date <= data["term"]["endDate"]
    selected_weeks = {day["teachingWeek"] for day in days}
    reminders = [event for event in data["courseEvents"] if selected_weeks.intersection(event["weeks"])]
    if course:
        reminders = [event for event in data["courseEvents"]
                     if course.casefold() in event["name"].casefold()
                     and (week is None or week in event["weeks"])
                     and (date is None or any(day["date"] == date and day["teachingWeek"] in event["weeks"] for day in data["days"]))]
    return {"profile": data["profile"], "term": data["term"], "filters": {"date": date, "week": week, "course": course},
            "inTerm": in_term, "days": days, "courseEvents": reminders,
            "pendingNotices": data["pendingNotices"], "limitations": data["limitations"]}


def format_text(result):
    lines = ["{} · {} · 课表".format(result["profile"]["name"], result["profile"]["className"])]
    if not result["inTerm"]:
        lines.append("日期在本导出包的学期范围外，不能据此判断其他学期是否有课。")
    if not result["days"] and result["inTerm"]:
        lines.append("没有符合筛选条件的固定节次课程；另请查看课程设计提醒。")
    for day in result["days"]:
        lines.append("\n{} {} · 第{}教学周".format(day["date"], day["weekday"], day["teachingWeek"]))
        if not day["formalCourses"]:
            lines.append("未登记固定节次正式课程。")
        for item in day["formalCourses"] + day["optionalCourses"]:
            status = "可选旁听" if item["optional"] else "正式课程"
            if item.get("attendanceStatus") == "occupied":
                status += "；被实验占用，本次不上理论课"
            if item.get("conflict"):
                status += "；与{}冲突，正式课优先".format("、".join(item["conflictNames"]))
            lines.append("  {} {} / {} / {} [{}]".format(item["periodLabel"], item.get("displayName") or item["name"], item["teacher"], item["room"], status))
            for note in dict.fromkeys([item.get("notice"), item.get("attendanceNotice")]):
                if note:
                    lines.append("    " + note)
        lines.extend("  日历提示：" + note for note in day["dateNotes"])
    for event in result["courseEvents"]:
        lines.append("课程设计提醒：{}；{}".format(event["name"], event["notice"]))
    for item in result["pendingNotices"]:
        lines.append("待确认：" + item["notice"])
    lines.extend("说明：" + note for note in result["limitations"])
    return "\n".join(lines)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="离线读取 T成长课表；不传参数时按北京时间查询今天。")
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--date", help="YYYY-MM-DD")
    selection.add_argument("--week", type=int, help="1–20")
    parser.add_argument("--course", help="课程名关键词；可与日期或教学周组合")
    parser.add_argument("--json", action="store_true", help="输出结构化 JSON")
    args = parser.parse_args()
    if args.date is None and args.week is None and args.course is None:
        args.date = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
    try:
        data = json.loads(Path(__file__).with_name("schedule.json").read_text(encoding="utf-8"))
        result = query(data, args.date, args.week, args.course)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else format_text(result))


if __name__ == "__main__":
    main()
