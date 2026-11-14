# T计划桌面与移动端边界

本次为 Windows 1.3.0；前端数据版本仍为 3。`courses.js`、`calendar.js`、`core.js`、看板计算及前端交互继续用无依赖 HTML/CSS/JS。Windows 宿主由 C# WinForms 和 Microsoft 官方 WebView2 构成。

## 离线加载与存储

- `build-standalone.cjs` 把页面、样式、6 个脚本和图标 data URI 合成单文件，并生成脚本和样式的 SHA-256 CSP。
- 编译器把单文件 HTML 与 ICO 嵌入 EXE。`https://tplan.local/index.html` 是宿主拦截并响应的本地虚拟资源地址，不是真实网站，也不启动 HTTP 服务。
- 资源处理只允许该入口 GET，其他请求返回 403；CSP `connect-src 'none'`，阻断外部导航与新窗口，不暴露宿主对象/消息桥。
- 宿主为本进程禁用系统代理，并使用正确引用的 `--host-resolver-rules="MAP * ^NOTFOUND"` 让域名解析直接失败，阻止虚拟源的预连接；关闭后台联网、QUIC、SmartScreen 和默认崩溃上传。`^NOTFOUND` 是 Chromium 的失败哨兵，不能替换成 `~NOTFOUND`。不修改 Windows 全局代理、防火墙或系统诊断设置。
- 网络验收检查启动到关闭的 WebView2 NetLog 中实际 TCP/UDP 连接、DNS 与发送事件。它是本机、有界时段的观测，不代表对操作系统所有服务或任意设备终身流量的保证。运行组件版本升级后须重新验证。
- 使用包内 Fixed Runtime；不从系统 Evergreen 复制，不把 Chrome/Edge 普通浏览器启动命令当作软件壳。默认无调试端口。
- 数据位于 `%LOCALAPPDATA%\TPlan\Profile`，稳定 origin 与 `tgrowth.v1` 保持跨安装位置一致。同一数据目录只允许一个实例；再次启动激活已有窗口。浏览器旧数据通过用户确认的 JSON 导入迁移。
- Win10 便携版首次启动和安装器按 Microsoft 说明，仅给包内 runtime 目录两个应用容器 SID 读取/执行权限；不修改整个用户目录或系统运行组件。
- QA 使用独立进程环境 `TPLAN_DATA_DIR`，并仅在该子进程设置官方 WebView2 CDP 参数；测试默认启动时另外确认没有端口。测试数据不进入发布白名单。

## 构建与交付

1. `desktop/vendor/PROVENANCE.md` 固定 SDK、Runtime 下载来源、版本与校验值；SDK/NuGet 和 Runtime/CAB 是构建输入，最终包只保留必需 DLL、完整 Runtime 及许可。
2. 执行 `desktop/build.ps1` 生成 `desktop/out/TPlan-win-x64`。`-SkipRuntimeCopy` 只适用于已完整复制 Runtime 后更新原生程序的开发构建。
3. `desktop/installer.iss` 用 Inno Setup 6 生成每用户安装器。安装器采用明确白名单；不打包整个工作台，不包含任何真实浏览器资料。
4. 发布压缩包和安装器生成后分别核对 SHA-256。源码编译通过、原生行为通过和干净机器通过是不同证据，不相互替代。

## Android 后续实现

下一阶段可继续使用同一套 HTML/CSS/JS 和 JSON 格式，在 Android 本地 WebView 宿主内加载受控本地资源，使用应用私有数据目录，并通过 Android 系统文件选择器完成 JSON 备份恢复。需单独实现文件下载/导入、返回键、生命周期及键盘遮挡处理，再在真实 Android 手机验证。

本次只完成手机宽度的可用布局和平台无关业务代码；没有 APK、Android SDK 工程、通知、后台服务或商店发布，不把桌面打包通过当作安卓验收。

后续平台迁移不能假定 localStorage 跨 Windows、浏览器、Android 自动同步。保持 JSON 导入预览、全量替换、损坏拒绝和历史快照兼容是移动端数据验收的前提。

参考：Microsoft WebView2 的[本地内容机制](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content)、[分发方式](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)、[DownloadStarting 回调示例](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.downloadstarting)、[Playwright WebView2 测试](https://playwright.dev/dotnet/docs/webview2)。

离线封装依据：[WebView2 参数说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags)、[Chromium 131 固定源码中的失败域名映射](https://raw.githubusercontent.com/chromium/chromium/131.0.6778.21/net/dns/mapped_host_resolver.cc)、[WebView2 数据与隐私说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/data-privacy)。浏览器参数不是操作系统网络沙箱；Microsoft 整体诊断仍受系统策略影响。本实现使用固定运行组件并做当前版本实测，不能把本机 NetLog 结果写成对所有 Windows 服务的全面保证。
