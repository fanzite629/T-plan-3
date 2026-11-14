"""Local development host for T计划智能版. Python standard library only."""
from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import zipfile
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from parser import MAX_FILE, extract_pdf_courses, extract_text, parse_excel_grid, parse_simple_lines

ROOT = pathlib.Path(__file__).resolve().parent
MIME = {"/": ("index.html", "text/html; charset=utf-8"),
        "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        "/style.css": ("style.css", "text/css; charset=utf-8")}
EXT_MIME = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise ValueError("未配置 OPENAI_API_KEY；可先使用本地识别和手工编辑")
    return key


def openai_request(prompt: str, content: list[dict]) -> dict:
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini").strip()
    if not model:
        raise ValueError("OPENAI_MODEL 不能为空")
    body = {"model": model, "store": False,
            "input": [{"role": "system", "content": [{"type": "input_text", "text": prompt}]},
                      {"role": "user", "content": content}],
            "text": {"format": {"type": "json_object"}}}
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses", data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key(), "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError(f"模型接口返回 HTTP {error.code}；请检查模型、额度和密钥") from error
    except urllib.error.URLError as error:
        raise ValueError("无法连接模型接口，请检查网络") from error
    output = "".join(item.get("text", "") for row in result.get("output", [])
                     for item in row.get("content", []) if item.get("type") == "output_text")
    if not output:
        raise ValueError("模型没有返回可解析文本")
    try:
        return json.loads(output)
    except json.JSONDecodeError as error:
        raise ValueError("模型返回的内容不是 JSON") from error


def valid_course(value: dict) -> dict:
    if not isinstance(value, dict):
        raise ValueError("课程格式错误")
    name = str(value.get("name", "")).strip()
    day, start, end = (value.get(k) for k in ("day", "start", "end"))
    weeks = value.get("weeks")
    if not name or len(name) > 100 or not all(type(x) is int for x in (day, start, end)):
        raise ValueError("课程名称或时间无效")
    if not (1 <= day <= 7 and 1 <= start <= end <= 20):
        raise ValueError("星期或节次超出范围")
    if not isinstance(weeks, list) or not weeks or len(weeks) > 30 or any(type(w) is not int or not 1 <= w <= 30 for w in weeks):
        raise ValueError("课程周次无效")
    return {"name": name, "day": day, "start": start, "end": end,
            "weeks": sorted(set(weeks)), "teacher": str(value.get("teacher") or "")[:100],
            "room": str(value.get("room") or "")[:100]}


EXTRACT_PROMPT = """你是学生课表结构化助手。只读取用户提供的课表，不猜测缺失字段。返回 JSON 对象：
{"courses":[{"name":"课程名","day":1,"start":1,"end":2,"weeks":[1,2],"teacher":"","room":""}],"warnings":["需要核实的内容"]}。
day 为周一=1 至周日=7；start/end 是节次序号而非钟点；weeks 是明确出现的教学周。单双周和周次范围须准确展开，无法确认周次的课程不要写入 courses，放入 warnings。图片或扫描件看不清时不要编造。"""
ANALYZE_PROMPT = """你是学习计划助手。返回 JSON 对象，字段为 summary（字符串）、actions（字符串数组）、questions（字符串数组）。
按用户给出的课程、任务、可用时间和目标给出可执行建议。不能假定教师、考试日期或作业要求；发现时间冲突应指出。输出是建议，不能替用户修改课程或任务。"""


def extract(body: dict) -> dict:
    name = str(body.get("name", ""))
    encoded = body.get("data", "")
    if len(encoded) > MAX_FILE * 2:
        raise ValueError("文件超过 10 MB")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as error:
        raise ValueError("上传数据不是有效的文件编码") from error
    text = extract_text(name, data)
    local = parse_simple_lines(text or "") or parse_excel_grid(text or "")
    local_warnings = []
    if name.lower().endswith(".pdf") and not body.get("useAI"):
        local, local_warnings = extract_pdf_courses(data)
    if not body.get("useAI"):
        return {"courses": [valid_course(c) for c in local], "warnings": local_warnings if local else local_warnings + [
            "本地规则未能可靠识别课程。可手工添加，或勾选使用 AI 识别并明确同意发送文件内容。"],
            "mode": "local"}
    ext = name.lower().rsplit(".", 1)[-1]
    if ext in EXT_MIME:
        if ext == "pdf":
            item = {"type": "input_file", "filename": name,
                    "file_data": "data:application/pdf;base64," + encoded}
        else:
            item = {"type": "input_image", "image_url": f"data:{EXT_MIME[ext]};base64,{encoded}"}
    else:
        if not text or not text.strip():
            raise ValueError("文件没有可读取的文字")
        item = {"type": "input_text", "text": text[:100000]}
    result = openai_request(EXTRACT_PROMPT, [item])
    courses = result.get("courses", [])
    if not isinstance(courses, list) or len(courses) > 200:
        raise ValueError("模型返回的课程数量或结构无效")
    warnings = result.get("warnings", [])
    if not isinstance(warnings, list):
        warnings = []
    return {"courses": [valid_course(c) for c in courses],
            "warnings": [str(w)[:300] for w in warnings[:30]], "mode": "ai"}


def analyze(body: dict) -> dict:
    courses = body.get("courses", [])
    tasks = body.get("tasks", [])
    if not isinstance(courses, list) or len(courses) > 200 or not isinstance(tasks, list) or len(tasks) > 200:
        raise ValueError("分析数据过多")
    clean = {"courses": [valid_course(c) for c in courses],
             "tasks": [{"title": str(t.get("title", ""))[:100], "date": str(t.get("date", ""))[:10],
                        "minutes": t.get("minutes", 0)} for t in tasks if isinstance(t, dict)],
             "goal": str(body.get("goal", ""))[:1000], "hoursPerWeek": body.get("hoursPerWeek", 0)}
    result = openai_request(ANALYZE_PROMPT, [{"type": "input_text", "text": json.dumps(clean, ensure_ascii=False)}])
    if not isinstance(result, dict):
        raise ValueError("模型返回的建议结构无效")
    actions, questions = result.get("actions"), result.get("questions")
    if not isinstance(actions, list) or not isinstance(questions, list):
        raise ValueError("模型返回的行动或待确认项格式无效")
    return {"summary": str(result.get("summary", ""))[:2000],
            "actions": [str(x)[:500] for x in actions[:10]],
            "questions": [str(x)[:500] for x in questions[:10]]}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        item = MIME.get(self.path)
        if not item:
            return self.send_error(404)
        data = (ROOT / item[0]).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", item[1])
        self.send_header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path not in {"/api/extract", "/api/analyze"}:
            return self.send_error(404)
        size = int(self.headers.get("Content-Length", "0"))
        if size < 1 or size > MAX_FILE * 2 + 10000:
            return self.send_json(413, {"error": "请求超过允许大小"})
        origin = self.headers.get("Origin")
        if origin and origin != f"http://127.0.0.1:{self.server.server_port}":
            return self.send_json(403, {"error": "仅接受本地页面请求"})
        try:
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("请求格式错误")
            result = extract(body) if self.path == "/api/extract" else analyze(body)
            self.send_json(200, result)
        except (ValueError, KeyError, zipfile.BadZipFile) as error:
            self.send_json(400, {"error": str(error)})
        except Exception:
            self.send_json(500, {"error": "处理失败；请检查文件格式或服务器日志"})

    def log_message(self, fmt, *args):
        # Do not log request bodies, file contents, or API keys.
        super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18766)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as server:
        print(f"T计划智能版: http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
