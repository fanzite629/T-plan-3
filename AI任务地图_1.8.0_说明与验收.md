# T计划 1.8.0 候选版：AI 任务拆解与可视化执行地图

日期：2026-10-22。主源码：`D:\Personal_work_station\Projects\T成长`。

## 交付边界

这是候选构建，不是正式安装更新。保留原有 1.7 工作台、独立课表、学习资源调度与可点击的独立验收；没有恢复分类、健康或周总结。没有上传、公开发布、修改桌面快捷方式或替换正式 EXE。

完整候选包：`releases\T计划_1.8.0_候选版`。EXE、三个 WebView2 DLL、runtime、licenses 必须一起保留。该 EXE 使用 `TPLAN_CANDIDATE` 编译，即使直接双击，默认数据根目录也是 `%LOCALAPPDATA%\TPlanCandidate180`，与正式版 `%LOCALAPPDATA%\TPlan` 分开。

先双击包内 `预览候选版_仅模拟.cmd`：它额外禁用真实 API 和密钥录入，可放心体验模拟示例及手动地图。不要把自动化测试 Profile 当成自己的业务数据。

正式版仍使用 `D:\Personal_work_station\考研\TPlan\T计划.exe`。根据本次要求，等待用户确认后才切换正式安装；此次未执行切换。

## 使用流程

1. 在今日主任务或本周任务列表中点击「执行地图」。新任务先保存，再打开地图。
2. 填写目标，可选补充已有进度、时间预算、截止时间、资料或限制。页面明确列出将发送的五项字段，不自动读取备注或其他任务。
3. 可以手动添加节点，或体验明确标注的模拟示例。真实调用需要先在原生安全设置中配置并启用，再显式点击「AI 拆解 · 发送并生成」。保存设置本身不联网。
4. 选择节点编辑标题、具体行动、预计分钟、完成标准、父节点及前置依赖。删除只影响未采用草稿，并移除对应依赖；直接子节点提升至被删节点的父级。
5. 确认后点击「采用方案」。超预算有额外确认，不自动延长计时底线。每个节点生成待办任务；重复采用不会重复创建。
6. 已采用节点点击「进入计时准备」，沿用现有计时器，收尾底线清空，等待用户重新设置并开始。也可编辑正式任务，或为某个子任务继续拆解。

实线箭头表示执行依赖；虚线「包含」表示子任务关系。两种关系独立校验。地图上标题、状态取自正式任务；最近卡点来自既有计时记录。没有第二套完成状态，没有自动确认任务完成。

## 数据与统计口径

- 继续使用 schemaVersion 3，新增可选 `taskMaps`，无此字段的旧 JSON 原样兼容；旧版程序不能保证识别新版地图字段，因此回退请使用修改前备份。
- `taskMaps.version=1`；每个计划保存根任务 ID、用户约束、草稿、已采用快照、节点到正式任务的 links、来源、修订号及创建任务快照。业务数据不依赖 LogicFlow 的画布格式。
- 节点字段：id、title、action、minutes、criterion、parentId、dependencies。节点不接受 AI 状态或正式任务 ID。正式 ID 由本机生成，状态初始为 todo。
- 每张草稿最多 30 节点，每节点 1—180 分钟；同一目标已采用的整棵执行树最多 30 子节点、3 层。不同任务可以分别建图，存储最多 300 份地图。
- 父任务原有预计时长保留；存在已采用子任务后，父任务作为汇总，不再次进入看板的目标时长合计。看板只累计末级任务预计时长。
- 原父任务和子任务的历史投入仍按各自日志记账，每条日志只进入总量一次。地图的含子任务投入仅供汇总展示，不生成日志；看板父行仅展示直属投入。删除正式任务沿用原有“保留/删除投入”的明确选择。
- 原方案预算作为不可改写的快照；地图另外显示当前正式末级任务预计时长，避免继续拆解后把旧快照误认为当前预算。
- 已采用方案不能重新生成覆盖。可以在子任务上新建一张地图。安全撤回只允许子任务未修改、未计时、无投入、无下级地图时；否则保留历史并提示编辑正式任务。
- 草稿及地图随业务 JSON 导入、导出、刷新和重启恢复。当前打开的地图用 sessionStorage 恢复；关闭后不自动打开。
- 图中布局按节点顺序自动排列，拖动画布/节点的位置不作为业务数据保存；编辑表单与节点列表提供稳定的键盘入口。

## DeepSeek、密钥与本地绘图

已核对 [DeepSeek 当前入门文档](https://api-docs.deepseek.com/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[错误码](https://api-docs.deepseek.com/quick_start/error_codes/)。默认可配置模型 `deepseek-flash`，并未照抄参考截图的旧模型名。

由 `desktop/AiTaskService.cs` 使用 HttpClient 请求固定的 `https://api.deepseek.com/chat/completions`；禁止自动重定向。非流式、json_object、最大输出 6000 tokens、90 秒超时；没有工具调用或自动重试。输入限长，响应限制 160KB，解析结果还要经过本地业务校验，才可保存为草稿。

受限 WebView2 消息只有 `ai-status`、`ai-settings`、`ai-generate`、`ai-cancel`，校验来源、消息尺寸、请求 ID、字段白名单；不提供任意 URL、HTML、代码或系统命令执行。取消、改动输入、任务变更或数据被外部更新后，旧响应不会覆盖草稿。

密钥只在原生 WinForms 设置窗口中输入。使用 Windows DPAPI CurrentUser 加密保存到数据根目录下 `AiSettings/credential.dpapi`；非敏感模型配置在 `AiSettings/model.json`。前端仅得到配置状态、启用状态和模型名，不得到密钥或尾号。业务 JSON 不包含设置密钥，不输出响应体或请求头日志。

API UI 参考了本机 T模电 `frontend/src/pages/system/Settings.jsx` 的服务卡片、配置状态与按钮组织；没有读取 T模电的账号或密钥。T计划继续使用蓝色、浅蓝和白色圆角卡片。

[LogicFlow 官方仓库](https://github.com/didi/LogicFlow) 标明 Apache-2.0；npm 官方 latest 元数据核验后锁定 `@logicflow/core=2.2.5`。依赖与构建工具在 package-lock.json 锁定，esbuild=0.25.12。JS、CSS 本地打包并嵌入 EXE，不依赖 CDN。许可证与第三方声明见 `assets/licenses/LogicFlow-and-dependencies.txt` 及包内同名文件。

兼容修正：原单文件脚本使用字符串替换插入库代码，会解释 `$&` 等字符，已改为回调替换；脚本仍用 CSP SHA-256 校验。LogicFlow 动态 SVG 样式允许 style 属性，不允许任意脚本或前端联网。库 CSS 的全局 focus reset 已限制在画布内，避免影响其他按钮的键盘焦点。

## 专注热力图

将专注统计「查看每天的数值」长表改为蓝色日历热力图。沿用今天/近7天/近30天和原计时记录：按收尾日期统计、扣除暂停、没有收尾的轮次不计入。颜色分档为 0、(0,15]、(15,30]、(30,60]、>60 分钟。日期显示具体分钟，点击/键盘激活显示轮次和分钟；统计不写入任何业务字段，也不改变实际投入确认机制。

## 测试与证据

测试均在独立合成数据下执行。详细结果以 `output/playwright/task-map` 内 JSON/TXT 为准。

- `unit-results.json`：12 项现有及新增核心测试脚本，包括核心数据、旧版本导入、课表、看板、计时、专注统计、学习资源、地图。
- `native-service-results.txt`：C# fake HttpMessageHandler 验证固定地址、结构化响应、DPAPI、未配置零请求、认证/余额/限流等异常、空内容/截断/非法 JSON、离线与取消；没有网络传输。
- `native-settings-results.json`：真实原生设置窗口验证密码框的 Windows 密码样式、验收模式禁用密钥录入和保存；未读取密钥值。原生窗口截图未纳入交付证据，UIA 检查不等同于完整视觉验收。
- `native-ui-results.json`：实际 Windows EXE/WebView2 下生成、编辑、采用、刷新、重复采用、取消/输入变更、XSS 文本展示、旧 JSON 导入、撤回、继续拆解、计时准备及窄屏布局。
- `exception-heatmap-results.json`：模拟异常响应不落库，外部数据变更保护，断网刷新已存地图，热力图日期、分档、点击详情、窄屏布局及统计不改数据。
- 固定底线与悬浮回归证据位于 `output/playwright/task-timer`，使用模拟时钟和真实原生悬浮窗口；不声称实际等候45分钟。
- 截图含 `execution-map.png`、`map-mobile.png`、`focus-heatmap.png`，全部使用合成数据。地图截图中的 HTML 样式文本是安全展示测试样本。
- 清晰预览另见 `map-config-preview.png`、`map-preview.png`；分别展示配置卡片和模拟执行路线。已人工查看地图和热力图截图。热力图窄屏布局断言通过，最终候选版的窄屏热力图截图未纳入证据。
- 最终计时桌面回归通过4组固定底线交互和3组原生悬浮同步；学习资源选择、剪贴板模板、独立验收步骤及显式确认7分钟实际投入也通过。测试之间重置合成数据与 UI 会话，避免前一项的卡片选择或窄视口影响后一项。

### 真实 API 事件与限制

开发期本应只使用 mock。验收时，早期隔离窗口的配置被更改为已配置密钥，原本测试“未配置”的一次自动化操作触发了真实 DeepSeek 请求，前端收到并保存了响应。此事已立即告知用户，实际费用无法确认；这不能作为完整真实 API 验收通过的证据。

随后停止该路径，保留早期隔离数据与加密密钥且不再读取，另建 `automation-only-profile`。增加宿主级 `TPLAN_AI_OFFLINE_TEST=1`：在读密钥及建立请求之前拒绝联网，原生设置在该模式禁用密钥录入和保存；C# 测试覆盖“即使已配置密钥也零请求”。后续验收强制使用此模式。早期隔离目录不包含在交付包内。

结论：mock 与离线功能按测试结果验收；首次受控真实调用、真实取消/超时/限流、生产密钥配置流程的端到端验收仍由用户之后明确触发，未宣称全面通过。

## 构建和回退

构建命令（PowerShell 7，项目目录）：

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
node bundle-map.cjs
& 'C:/Users/fanzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe' -NoProfile -File desktop/build.ps1 -OutputDirectory out/TPlan-1.8.0-candidate2 -Candidate
```

构建已具备 runtime 时可加 `-SkipRuntimeCopy`。正常发布构建不传 `-Candidate`，但本次没有替换或安装正常发布版本。

修改前备份：`backups/before-task-map-20261022-154959`，包含原 1.7 源码、desktop 源码、测试和真实 Profile 的197文件快照及 SHA-256 清单。源代码恢复请先关闭候选测试进程、另备份当前源码，再把备份文件复制回原路径；此次新增地图模块和 npm 文件可先移到单独目录保留。不要直接恢复运行中的 Profile。

运行回退：关闭候选版，继续打开原桌面 T计划 快捷方式即可，正式 EXE 和真实 Profile 未被替换。候选里的新记录不会自动同步到正式版；先导出候选 JSON 留存，旧版不支持新地图字段时使用修改前兼容备份。除非确认出现数据损坏，否则不要用旧 Profile 覆盖后续正常学习记录。

之后切换：用户先确认候选结果并结束当前真实计时，再备份当时最新的业务数据，由本会话另行更新正式版本。不是将验收 Profile 复制到正式目录。
