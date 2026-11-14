# T计划 v3 桌面版

当前源码版本为 **3.8.0.0**，Windows x64，C# WinForms + WebView2 + 本机 SQLite。界面由 HTML、CSS 和 JavaScript 构成，构建时将模块合并后嵌入 EXE。

## 功能

- 今日任务、课程或项目分区、置顶、日期安排与侧栏分组拖动排序。
- 本周七天任务、计划时长、本周未定、拖动改期与撤销。
- 计时、暂停和继续、到时提醒、结束记录，以及原生置顶计时小窗。
- 时间统计、记录编辑、个人反思与独立的 AI 复盘草稿。
- AI 提议：输入目标、查看和修改草稿、确认后写入任务或决策树。
- 决策树分支与步骤编辑、加入任务安排。
- 本机数据持久化、导入导出；AI 服务由用户在设置中自行配置。

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
| `build.ps1` | 合并页面、编译、打包运行依赖 |
| `installer.iss` | Inno Setup 安装器脚本 |

`index.html` 是 `build.ps1` 自动生成的桌面页面，不应手工修改，也未纳入 Git。仅打开 `app.html` 不会加载全部桌面增强模块。

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

## 数据

应用默认将个人记录保存在 `%LOCALAPPDATA%\TPlanV3\tplan.sqlite3`，不随 Git 同步。API 密钥由当前 Windows 用户环境保护，不写入仓库。更换电脑前请使用应用的数据导出功能备份；提交源码不会备份个人记录。
