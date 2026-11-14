# T计划 v3 桌面版

当前源码版本为 **3.12.0.0**，Windows x64，C# WinForms + WebView2 + 本机 SQLite。界面由 HTML、CSS 和 JavaScript 构成，构建时将模块合并后嵌入 EXE。

## 功能

- 今日任务、课程或项目分区、置顶、日期安排与侧栏分组拖动排序。
- 本周七天任务、计划时长、本周未定、拖动改期与撤销。
- 计时、暂停和继续、到时提醒、结束记录，以及原生置顶计时小窗。
- 时间统计、记录编辑、个人反思与独立的 AI 复盘草稿。
- AI 提议：输入目标、查看和修改草稿、确认后写入任务或决策树。
- 决策树分支与步骤编辑、加入任务安排。
- 本机数据持久化、导入导出；AI 服务由用户在设置中自行配置。
- 橙橙桌宠：独立透明置顶、拖动、左右移动、漫游、跟随鼠标、招手、三档大小及托盘找回；保留用户原图。
- 学习助理：复用现有模型配置，结合任务与计时摘要进行问答、复盘和任务拆解；草稿经用户检查、确认后写入。五种场景可切换。

## 源码入口

| 文件 | 用途 |
| --- | --- |
| `app.html` | 页面基础源码 |
| `*-ui.js`、`*.css` | 各页面交互与样式 |
| `*-core.js` | 可独立测试的数据与业务逻辑 |
| `sidebar*.js`、`sections*.js` | 导航、分区与排序 |
| `App.cs` | 程序入口、SQLite 数据存储与密钥保护 |
| `MainWindow.cs` | 桌面窗口、WebView2 与前端桥接 |
| `TimerMiniWindow.cs`、`timer-bridge.js` | 原生计时小窗与主界面同步 |
| `AiGateway.cs` | 模型请求与响应处理 |
| `CompanionWindow.cs` | 透明桌宠、移动、交互、托盘与计时状态 |
| `CompanionMotion.cs` | 按实际位移推进的八帧步态、待机眨眼与呼吸 |
| `CompanionActivity.cs` | 学习、看书、休息循环与计时状态切换 |
| `CompanionBlend.cs` | 透明帧混合、可中断的动作过渡与移动加减速 |
| `CompanionPanel.cs`、`CompanionAgent.cs` | 本机对话、场景与模型请求 |
| `companion-ui.js`、`companion-assets/` | 桌宠入口、事实摘要、草稿桥接与美术资源 |
| `build.ps1` | 合并页面、编译、打包运行依赖 |
| `installer.iss` | Inno Setup 安装器脚本 |

`index.html` 是 `build.ps1` 自动生成的桌面页面，不应手工修改，也未纳入 Git。仅打开 `app.html` 不会加载全部桌面增强模块。

## 桌宠使用

启动 T计划后，橙橙独立显示在桌面右下角。拖动人物调整位置，单击招手，双击打开学习助理，右键选择移动、漫游、跟随、大小、置顶、休息提醒或收起。主窗口最小化不影响桌宠，退出 T计划时一并退出；收起后可通过侧栏“桌宠与助理”或托盘重新打开。运行专注计时期间，自动漫游和跟随暂停。

助理支持 Ctrl+Enter 发送，生成时可取消。发送时使用现有模型配置，并传送本次问题、最近对话和任务/计时摘要。她可以解释学习问题、帮助选下一步、复盘已有记录并生成任务草稿；任务需进入可编辑预览后由用户确认。当前没有任意电脑操作、网页搜索或自动读文件权限。

桌宠左右移动各使用独立的八帧步行动画，脚步随实际位移推进；停止、到达屏幕边缘后回到原图待机。待机时自然眨眼并轻微呼吸，可在右键菜单关闭“待机眨眼与呼吸”。眨眼仅覆盖眼部，呼吸保持脸部比例和脚底位置；完整原图保留不变。步行帧是以原图为参考生成的详细姿态，并非把整个人物缩放后平移，也不是 Live2D 骨骼模型。原画身份及资源来源见 `companion-assets/README.md`，动画预览见 `../designs/companion-motion-20261114/preview.html`。五种学习生活场景显示在助理面板中。

偏好与最近 40 条对话分别保存在 `%LOCALAPPDATA%/TPlanV3/pet-settings.json` 和 `pet-chat.json`，与 SQLite 任务记录分开。未点击“检查任务草稿”的模型草稿只保留在当前会话内；检查后的草稿保存在现有 AI 提议中。休息提醒为本次运行内的 20 分钟提醒，退出后不继续运行。

3.11 新增三组四帧陪伴动作：学习写笔记、捧书翻页、坐着放松。右键“陪伴动作”可手动选择，也可回到原图待机。“跟随计时自动切换”默认开启：开始/继续计时进入学习，暂停/自然到时/结束后休息，保存或放弃本轮记录后继续休息。手动选择在下一次真实计时状态变化前保持；关闭自动切换后则始终保持所选动作。动作偏好可随软件重启恢复，不写入任务或时间记录。

学习、看书、休息期间暂缓自动漫游/跟随，避免桌椅随人物漂移；手动左右移动或招手结束后返回当前动作。非计时运行期间，显式开启漫游/跟随会回到原图待机并开始走动。新动作预览见 `../designs/companion-activities-20261114/preview.html`。

3.12 在现有详细 PNG 帧之间增加连续混合，动作间以 240–360 毫秒短过渡衔接。快速切换从当前显示画面继续，走路有加速、减速与小数位移累积。拖动、右键菜单和隐藏状态暂停动画时钟；计时数据即时更新，不等待动画结束。39 张原有美术资源均未修改。这是现有帧的播放与混合优化，没有新画中间姿态或新增骨骼模型。[交互预览](../designs/companion-smooth-20261114/preview.html)与[发布记录](桌宠流畅过渡-3.12.md)可查看细节。

## 构建

在 Windows x64 上准备 .NET Framework 4.8。构建脚本使用系统自带的 Framework64 C# 编译器。

大体积的第三方二进制依赖不存入本仓库。下载来源、固定版本、校验值与许可证记录见 [`../desktop/vendor/PROVENANCE.md`](../desktop/vendor/PROVENANCE.md)。先按该记录准备：

```text
desktop/vendor/sdk/
  lib/net462/Microsoft.Web.WebView2.Core.dll
  lib/net462/Microsoft.Web.WebView2.WinForms.dll
  runtimes/win-x64/native/WebView2Loader.dll
  LICENSE.txt
  NOTICE.txt
desktop/vendor/runtime/Microsoft.WebView2.FixedVersionRuntime.152.0.4191.62.x64/
  msedgewebview2.exe
  ...全部运行时文件
```

SDK 包固定为 `Microsoft.Web.WebView2 1.0.4191.47`，解压到 `desktop/vendor/sdk/`。Fixed Runtime 使用记录中的 `152.0.4191.62 x64`，保留完整解包目录；运行时许可证已保存在 `desktop/vendor/`。

在仓库根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\v3-desktop\build.ps1
```

输出是 `v3-desktop/package/`。运行其中的 `T计划 v3.exe`，同时保留 DLL、`runtime/` 与许可证目录。若需要安装器，准备 Inno Setup 后编译 `installer.iss`。现有本机升级脚本包含开发机路径与验收约束，换电脑时应先阅读配置，不要直接执行 `install-local.ps1` 或 `upgrade-local.ps1`。

## 测试

安装 Node.js 后，在仓库根目录运行以下不调用外部 AI、也不读取个人数据库的核心测试：

```powershell
node --test v3-desktop/planning-core.test.cjs v3-desktop/tree-core.test.cjs v3-desktop/sections-core.test.cjs v3-desktop/timer-core.test.cjs
```

`qa-*.cjs` 是桌面集成测试脚本；部分仍带有开发机上的 Playwright 路径及隔离测试目录，需要先按新环境调整。`qa-deepseek-live.cjs` 属于真实模型集成验证，不是离线测试。各次功能验收 Markdown 文件保留的是历史测试结果，不代表任意新机器已经通过验证。

`tools/CompanionMotionTests.cs` 验证步态、眨眼区域、原图校验值和脚底锚点；`qa-companion-motion.cjs` 在隔离的本机桌面进程中验证动画、移动、边界、三档大小与偏好持久化。3.10 升级按当前 EXE 的应用回归、桌宠集成、动画集成及视觉检查报告验收；3.9 的原生计时和真实模型报告保留为历史证据，不冒充此次重新实测。

`tools/CompanionActivityTests.cs` 和 `qa-companion-activity.cjs` 验证活动帧推进、计时状态联动、手动覆盖、自动切换开关、结束记录、完整重启和与移动/招手的衔接。3.11 同时要求当版动画和陪伴动作集成报告通过。

## 数据

应用默认将个人记录保存在 `%LOCALAPPDATA%\TPlanV3\tplan.sqlite3`，不随 Git 同步。API 密钥由当前 Windows 用户环境保护，不写入仓库。更换电脑前请使用应用的数据导出功能备份；提交源码不会备份个人记录。
