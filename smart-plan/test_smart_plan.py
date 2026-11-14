import base64
import io
import json
import unittest
import zipfile
from unittest.mock import patch

import parser
import server


def xlsx_fixture():
    xml = '''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>节次</t></is></c><c r="B1" t="inlineStr"><is><t>周一</t></is></c><c r="C1" t="inlineStr"><is><t>周二</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>1-2节</t></is></c><c r="B2" t="inlineStr"><is><t>高等数学 第1-16周</t></is></c></row>
    </sheetData></worksheet>'''
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w") as zf:
        zf.writestr("xl/worksheets/sheet1.xml", xml)
    return memory.getvalue()


class SmartPlanTests(unittest.TestCase):
    def test_local_excel_grid(self):
        result = server.extract({"name": "课表.xlsx", "data": base64.b64encode(xlsx_fixture()).decode(), "useAI": False})
        self.assertEqual(result["courses"], [{"name": "高等数学", "day": 1, "start": 1, "end": 2,
                                              "weeks": list(range(1, 17)), "teacher": "", "room": ""}])

    def test_simple_text_and_svg(self):
        self.assertEqual(parser.parse_simple_lines("周三 5-6节, 物理实验, 3-8周")[0]["day"], 3)
        self.assertIn("周一", parser.extract_svg('<svg xmlns="http://www.w3.org/2000/svg"><text>周一</text></svg>'.encode()))

    def test_stacked_pdf_cell_and_nonconsecutive_weeks(self):
        cell = "课程甲\n教师甲\n1-5([周])[01-02节]\n一教101\n课程乙\n教师乙\n7,9,11,13([\n周])[01-02\n节]\n二教202"
        courses, warnings = parser._cell_courses(cell, 3)
        self.assertEqual(warnings, [])
        self.assertEqual(len(courses), 2)
        self.assertEqual(courses[0]["room"], "一教101")
        self.assertEqual(courses[1]["weeks"], [7, 9, 11, 13])

    def test_image_without_ai_keeps_data_local(self):
        result = server.extract({"name": "课表.png", "data": base64.b64encode(b"synthetic").decode(), "useAI": False})
        self.assertEqual(result["courses"], [])
        self.assertEqual(result["mode"], "local")

    def test_ai_result_rejected_when_invalid(self):
        with patch.object(server, "openai_request", return_value={"courses": [{"name": "课", "day": 8,
                   "start": 1, "end": 2, "weeks": [1]}], "warnings": []}):
            with self.assertRaises(ValueError):
                server.extract({"name": "课表.png", "data": base64.b64encode(b"synthetic").decode(), "useAI": True})

    def test_analysis_does_not_mutate_inputs(self):
        body = {"courses": [{"name": "高等数学", "day": 1, "start": 1, "end": 2, "weeks": [1]}],
                "tasks": [], "goal": "复习", "hoursPerWeek": 10}
        original = json.dumps(body, ensure_ascii=False)
        with patch.object(server, "openai_request", return_value={"summary": "建议", "actions": ["先复习"], "questions": []}):
            self.assertEqual(server.analyze(body)["actions"], ["先复习"])
        self.assertEqual(json.dumps(body, ensure_ascii=False), original)


if __name__ == "__main__":
    unittest.main()
