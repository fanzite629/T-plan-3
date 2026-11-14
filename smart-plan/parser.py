"""Read timetable candidates without executing uploaded documents."""
from __future__ import annotations

import csv
import io
import re
import zipfile
from xml.etree import ElementTree as ET

MAX_FILE = 10 * 1024 * 1024
MAX_XML = 8 * 1024 * 1024
DAY = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 7, "天": 7}
OFFICE_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
             "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def _xml_part(zf: zipfile.ZipFile, name: str):
    info = zf.getinfo(name)
    if info.file_size > MAX_XML:
        raise ValueError("文档中的 XML 部分过大")
    return ET.fromstring(zf.read(name))


def extract_xlsx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        strings = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = _xml_part(zf, "xl/sharedStrings.xml")
            strings = ["".join(t.text or "" for t in si.findall(".//m:t", OFFICE_NS))
                       for si in root.findall("m:si", OFFICE_NS)]
        sheets = sorted(n for n in zf.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n))
        if not sheets:
            raise ValueError("Excel 文件没有可读取的工作表")
        lines = []
        for name in sheets[:10]:
            root = _xml_part(zf, name)
            lines.append("# " + name)
            for row in root.findall(".//m:sheetData/m:row", OFFICE_NS)[:300]:
                cells = []
                for cell in row.findall("m:c", OFFICE_NS)[:30]:
                    value = cell.find("m:v", OFFICE_NS)
                    if cell.attrib.get("t") == "inlineStr":
                        text = "".join(t.text or "" for t in cell.findall(".//m:t", OFFICE_NS))
                    elif value is not None:
                        text = value.text or ""
                        if cell.attrib.get("t") == "s":
                            idx = int(text)
                            text = strings[idx] if 0 <= idx < len(strings) else ""
                    else:
                        text = ""
                    if text.strip():
                        cells.append(f"{cell.attrib.get('r', '')}:{text.strip()}")
                if cells:
                    lines.append(" | ".join(cells))
        return "\n".join(lines)[:100000]


def extract_docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        root = _xml_part(zf, "word/document.xml")
        lines = []
        for para in root.findall(".//w:p", OFFICE_NS):
            line = "".join(t.text or "" for t in para.findall(".//w:t", OFFICE_NS)).strip()
            if line:
                lines.append(line)
        return "\n".join(lines)[:100000]


def extract_svg(data: bytes) -> str:
    root = ET.fromstring(data)
    return "\n".join((e.text or "").strip() for e in root.iter()
                     if e.tag.rsplit("}", 1)[-1] in {"text", "tspan"} and (e.text or "").strip())[:100000]


def extract_text(name: str, data: bytes) -> str | None:
    if len(data) > MAX_FILE:
        raise ValueError("文件超过 10 MB")
    ext = name.lower().rsplit(".", 1)[-1]
    if ext == "xlsx":
        return extract_xlsx(data)
    if ext == "docx":
        return extract_docx(data)
    if ext == "svg":
        return extract_svg(data)
    if ext in {"csv", "txt"}:
        return data.decode("utf-8-sig", errors="replace")[:100000]
    if ext in {"pdf", "png", "jpg", "jpeg"}:
        return None
    raise ValueError("支持 xlsx、docx、csv、txt、pdf、png、jpg、svg；旧版 xls/doc 请另存为新版格式")


def parse_simple_lines(text: str) -> list[dict]:
    """Conservative local parser for one-course-per-line text, never guesses missing weeks."""
    result = []
    pattern = re.compile(r"(?:周|星期)([一二三四五六日天])\s*[，,;；|/\- ]+\s*(\d{1,2})\s*[-–—~至]\s*(\d{1,2})\s*节?\s*[，,;；|/\- ]+\s*(.+?)\s*[，,;；|/\- ]+\s*(?:第)?([\d,，、\s-]+)周")
    for line in text.splitlines():
        match = pattern.search(line)
        if not match:
            continue
        day, first, last, name, weeks_text = match.groups()
        a, b = int(first), int(last)
        if a < 1 or b > 20 or a > b or len(name) > 100:
            continue
        weeks = set()
        for part in re.split(r"[,，、\s]+", weeks_text.strip()):
            if not part:
                continue
            if "-" in part:
                lo, hi = [int(x) for x in part.split("-", 1)]
                if 1 <= lo <= hi <= 30:
                    weeks.update(range(lo, hi + 1))
            elif part.isdigit() and 1 <= int(part) <= 30:
                weeks.add(int(part))
        if weeks:
            result.append({"name": name.strip(), "day": DAY[day], "start": a, "end": b,
                           "weeks": sorted(weeks), "teacher": "", "room": ""})
    return result


def parse_excel_grid(text: str) -> list[dict]:
    """Read a common grid: weekday headers above period rows, explicit weeks in each cell."""
    result = []
    rows = []
    for line in text.splitlines():
        cells = {}
        for item in line.split(" | "):
            match = re.match(r"([A-Z]+)(\d+):(.*)", item, re.S)
            if match:
                cells[match.group(1)] = match.group(3).strip()
        if cells:
            rows.append(cells)
    headers = {}
    header_index = -1
    for i, row in enumerate(rows):
        found = {col: DAY[m.group(1)] for col, value in row.items()
                 if (m := re.search(r"(?:周|星期)([一二三四五六日天])", value))}
        if len(found) >= 2:
            headers, header_index = found, i
            break
    if not headers:
        return []
    for row in rows[header_index + 1:]:
        period = next((re.search(r"(\d{1,2})\s*[-–—~至]\s*(\d{1,2})\s*节?", value)
                       for col, value in row.items() if col not in headers and
                       re.search(r"(\d{1,2})\s*[-–—~至]\s*(\d{1,2})\s*节?", value)), None)
        if period is None:
            continue
        first, last = int(period.group(1)), int(period.group(2))
        if first < 1 or last > 20 or first > last:
            continue
        for col, day in headers.items():
            cell = row.get(col, "")
            wm = re.search(r"(?:第)?\s*(\d{1,2})\s*[-–—~至]\s*(\d{1,2})\s*周", cell)
            if not wm:
                wm = re.search(r"(?:第)?\s*(\d{1,2})\s*周", cell)
            if not wm:
                continue
            lo, hi = int(wm.group(1)), int(wm.group(2) or wm.group(1))
            if not 1 <= lo <= hi <= 30:
                continue
            name = re.sub(r"(?:第)?\s*\d{1,2}\s*(?:[-–—~至]\s*\d{1,2})?\s*周", "", cell).strip(" ;；,，、()（）")
            if name:
                result.append({"name": name[:100], "day": day, "start": first, "end": last,
                               "weeks": list(range(lo, hi + 1)), "teacher": "", "room": ""})
    return result


_PDF_MARKER = re.compile(
    r"(?P<weeks>\d[\d,，、\s\-–—~至]*)\(\[\s*周\]\)\[\s*(?P<first>\d{1,2})\s*[-–—~至]\s*(?P<last>\d{1,2})\s*节\]"
)
_ROOM_START = re.compile(r"^(?:[一二三四五六七八九十][东西中教]|东阶|三教|操场|[A-Z]\d|[、，,\d])")


def _weeks(value: str) -> list[int]:
    weeks = set()
    for part in re.split(r"[,，、\s]+", value.strip()):
        if not part:
            continue
        match = re.fullmatch(r"(\d{1,2})(?:[-–—~至](\d{1,2}))?", part)
        if not match:
            return []
        a, b = int(match.group(1)), int(match.group(2) or match.group(1))
        if not 1 <= a <= b <= 30:
            return []
        weeks.update(range(a, b + 1))
    return sorted(weeks)


def _cell_courses(cell: str, day: int) -> tuple[list[dict], list[str]]:
    """Parse stacked course blocks from a text-based PDF table cell."""
    cell = re.sub(r"\(\[\s*周\]\)", "([周])", cell)
    cell = re.sub(r"\[(\d{1,2})\s*[-–—~至]\s*(\d{1,2})\s*节\]", r"[\1-\2节]", cell)
    markers = list(_PDF_MARKER.finditer(cell))
    if not markers:
        return [], ["课表单元格含有文字，但未识别出明确的教学周和节次"] if cell.strip() else []
    courses, warnings = [], []
    end = 0
    for marker in markers:
        lines = [line.strip() for line in cell[end:marker.start()].splitlines() if line.strip()]
        if courses:
            room_lines = []
            while lines and _ROOM_START.match(lines[0]):
                room_lines.append(lines.pop(0))
            courses[-1]["room"] = "".join(room_lines)[:100]
        weeks = _weeks(marker.group("weeks"))
        first, last = int(marker.group("first")), int(marker.group("last"))
        if len(lines) < 2 or not weeks or not 1 <= first <= last <= 20:
            warnings.append("有一处课程名称、教师或周次无法可靠拆分，请在原文件中核对")
        else:
            courses.append({"name": "".join(lines[:-1])[:100], "teacher": lines[-1][:100],
                            "room": "", "day": day, "start": first, "end": last,
                            "weeks": weeks})
        end = marker.end()
    if courses:
        courses[-1]["room"] = "".join(line.strip() for line in cell[end:].splitlines() if line.strip())[:100]
    return courses, warnings


def extract_pdf_courses(data: bytes) -> tuple[list[dict], list[str]]:
    """Text-table PDF path; scanned PDFs remain an explicit unsupported local case."""
    try:
        import pdfplumber
    except ImportError as error:
        raise ValueError("本地 PDF 解析组件 pdfplumber 不可用；请使用项目说明中的 Python 环境，或使用已配置的 AI 识别") from error
    rows, warnings = [], []
    with pdfplumber.open(io.BytesIO(data)) as document:
        if len(document.pages) > 20:
            raise ValueError("PDF 超过 20 页，暂不作为单张课表导入")
        for page_index, page in enumerate(document.pages, 1):
            for table in page.extract_tables():
                headers = None
                for row in table:
                    row = row or []
                    found = {col: DAY[match.group(1)] for col, value in enumerate(row)
                             if value and (match := re.search(r"星期([一二三四五六日天])", value))}
                    if len(found) >= 2:
                        headers = found
                        continue
                    if not headers:
                        continue
                    if row and row[0] and "周" in row[0] and not any(row[col] for col in headers if col < len(row)):
                        notice = "".join(row[0].split())
                        warnings.append(f"第{page_index}页另有无固定星期或节次的安排，未导入课表：{notice[:180]}")
                        continue
                    for col, day in headers.items():
                        if col >= len(row) or not row[col] or not row[col].strip():
                            continue
                        cell_courses, cell_warnings = _cell_courses(row[col], day)
                        rows.extend(cell_courses)
                        warnings.extend(f"第{page_index}页、星期{day}：{warning}" for warning in cell_warnings)
        if not rows:
            warnings.append("PDF 未提取到可确认周次和节次的课程；扫描件或复杂版式可使用 AI 识别")
    return rows, warnings[:30]
