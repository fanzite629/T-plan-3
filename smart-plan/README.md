# T计划智能版 · 独立原型

这是基于 T计划「今日／课表／任务／分析／数据」使用骨架新建的软件原型。它在 `smart-plan/` 中运行，**不读取或改写**原 T计划的 `tgrowth.v1`、已安装的 EXE 或 `%LOCALAPPDATA%\TPlan\Profile`。本版是本机网页应用，需要 Python 3.10+；本地 PDF 表格识别另需当前 Python 环境具备 `pdfplumber`。尚未封装成 Windows 安装包或 Android APK。

## 启动

在此目录执行：

```powershell
python server.py --port 18766
```

在这台电脑上，已验证下列 Python 自带 `pdfplumber`，可直接用于本地识别你提供的文字表格 PDF：

```powershell
& 'C:\Users\fanzi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' server.py --port 18766
```

如果换用系统默认 `python` 且其中没有 `pdfplumber`，这份 PDF 的本地识别会提示缺少解析组件。上面的路径属于这台电脑的运行环境，换电脑时须使用具备该组件的 Python。

再在浏览器打开 `http://127.0.0.1:18766/`。服务器仅监听 `127.0.0.1`。个人课表、任务与目标保存在当前浏览器的 `tplan.smart.v1`；更换浏览器、端口或清理站点数据前，先从「数据管理」导出 JSON。此原型不进行自动跨设备同步。

## 课表导入

拖入或选择单个不超过 10 MB 的 `xlsx`、`docx`、`csv`、`txt`、`pdf`、`png`、`jpg/jpeg` 或 `svg`。

- `xlsx`、`docx`、`csv`、`txt`、`svg`：先在本地读取文字。规则识别支持「周一 1-2节, 高等数学, 1-16周」这类逐行写法，以及带星期表头、节次行和明确周次的常见 Excel 网格。复杂版式可选择 AI 识别。
- `pdf`：可选择文字的表格 PDF 会先尝试本地识别；当前 Python 环境须具备 `pdfplumber`。扫描件或无法拆分的复杂表格可选择 AI 识别。
- 图片：当前需要 AI 识别。图片及选择 AI 的 PDF 内容仅在本次勾选「使用 AI 识别」并确认后送往模型接口。模糊图片及复杂合并单元格不保证识别准确。
- 旧版 `.xls`、`.doc` 请先在 Office/WPS 中另存为 `.xlsx`、`.docx`。
- 识别结果始终先进入可编辑预览；空周次不推测，冲突会提示。确认后只替换智能版课表，保留任务。建议导入前先导出备份。

## 模型接口

当前接入 OpenAI Responses API。**不在页面、源码或浏览器存储 API 密钥**。启动前在当前 PowerShell 会话设置环境变量：

```powershell
$env:OPENAI_API_KEY = '<你的密钥>'
$env:OPENAI_MODEL = 'gpt-4.1-mini'
python server.py --port 18766
```

密钥及模型应由你自己选择和配置；模型调用可能产生费用。本地导入和手工课表管理不需要密钥。点击「生成 AI 分析」会先显示发送范围并再次确认，模型只提供建议，不自动修改课表或任务。服务器请求设置 `store: false`；具体数据处理仍受所选 API 服务条款约束。本版尚未用真实密钥验证模型接口。

## 验证

```powershell
python -m unittest -v test_smart_plan.py
node --check app.js
```

已测试本地 Excel 网格、文本、SVG 提取、PDF 叠放课程与隔周周次、未授权图片不发送、无效 AI 课程拒绝和分析输入不变性。2026-09-23 使用 `大二下课表.pdf` 验证了浏览器文件选择 → 本地解析 → 19 个课程场次预览 → 确认导入 → 刷新后保留；另外两项未标明具体星期和节次的活动仅提示人工核对，未猜测并写入课程。PDF 未发送到模型接口。未填写第一教学周日期时，“今日”与“本周任务时间”不推测当前周。正式发布前仍需用不同学校的真实课表样本评估识别率、用自己选定的模型与密钥做联调，并决定是否制作独立 Windows 安装包。
