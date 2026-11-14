# T计划 V1.3 桌面与 UI 验收

验收日期：2026-09-07。当前结论：**已运行的业务与界面项目 PASS；原生网络封装缺陷已按失败→修复→实际复测闭环，限定网络检查通过。完整验收仍为 PARTIAL。** 浏览器 HTML 文件直开及操作系统物理断网初开仍为 NOT RUN，不能被原生软件虚拟 HTTPS 验收替代。

本轮依据：用户要求按参考图改名为 T计划、保留原有学习功能并制作真正的 Windows 独立窗口软件；[合并方案第 8 节](T成长_运行规则与资源配置_合并方案_20260907.md)继续作为原业务验收基线。界面图片中的示例课表不作事实来源，测控软件技术仍为第 3–8 周、周一 7–8 节及周三 9–10 节。数据协议保持 schema 3、存储键 `tgrowth.v1`。

所有截图、JSON、任务、体重与课程学习文本均为**隔离的合成验收数据**。未使用用户真实浏览器或 `%LOCALAPPDATA%\TPlan` 的 profile；没有改写系统剪贴板。测试不经过 file 导航，不新增外部服务或依赖。

## 第 8 节逐项对应

| 基线项目 | 本轮实际证据与范围 | 结论 |
|---|---|---|
| 1. 1 主任务、最多 3 个重点，完成后不自动补主任务 | Chrome/Edge 新界面首页可见性与主任务断言；原生创建任务并设置主任务后，跨进程重启仍保留；未改动核心对应逻辑再次运行 | PASS |
| 2. 实际投入按日期，完成/编辑/删除/导入不重复计时 | 双浏览器课后任务完成不生成预计的 30 分钟；真实投入 25→35 分钟只累计一次；饼图投入编辑、删除同步；原生 45 分钟导出导入逐字段一致 | PASS |
| 3. 健身天数与分钟分离，超预算/零目标 | 饼图与比例图按实际分钟计算，健身天数独立；核心及 dashboard 测试覆盖空分母、零目标和预算边界 | PASS |
| 4. 跨周延期和历史事实、目标、总结保留 | 核心历史/延期/快照用例；本轮浏览器生成含本节主题、实际成果、证据与卡点的周总结，保存和复制路径正常 | PASS |
| 5. 课表周次、旁听冲突、实验待定 | 本轮 courses 10 组、calendar 13 组实际执行；新 UI 课次按 courseId/date 隔离并可从历史打开；特殊安排收进可展开区域 | PASS |
| 6. 体重缺失、样本天数与窗口 | 核心及 dashboard 统计用例保持通过；原生真实记录 157 斤并在 JSON 恢复后完整保留；没有加入医疗建议 | PASS |
| 7. JSON 导出→清空→导入；损坏数据不覆盖 | 双浏览器实际下载与完整恢复；原生真正 Windows 保存框等待 3 秒后保存，再清空、导入、逐字段比较；负数分钟损坏备份拒绝且原数据不变；schema 2→3 兼容回归通过 | PASS |
| 8. Chrome/Edge、文件直开、断网、刷新、390px、错误和网络 | 双浏览器 HTTP 隔离预览及五页 1440/390px 通过；原生虚拟 HTTPS 已加载后模拟断网含刷新、CRUD 通过。原生系统代理预连接缺陷修复后，限定启动 NetLog 的连接/发送事件均为 0。HTML file 直开及操作系统物理断网初开 NOT RUN | **PARTIAL：已运行部分 PASS，未运行边界保留** |

前七组同时使用本轮逻辑回归补足边界，并非把旧报告结果直接改名为新结果。原 V1 的全部 46 项没有在这一轮再次全跑。

## 分阶段实际执行

| 阶段 | 实际结果 | 证据 |
|---|---|---|
| 本验收代理独立运行 V1.2 与新 UI 回归 | **41 PASS / 0 FAIL**，包含 5 个纯数据组及 Chrome、Edge 各 18 个 UI 组 | [v12-results.json](tests/desktop-evidence/regression-v12/v12-results.json) |
| 本验收代理独立运行原饼图业务回归 | **16 PASS / 0 FAIL** | [pie-results.json](tests/desktop-evidence/regression-pie/pie-results.json) |
| 根线程本轮实际运行逻辑测试 | **104 PASS / 0 FAIL**：core 29、v11-core 14、v12-core 25、courses 10、calendar 13、dashboard 13。该文件是本轮工具输出汇总，不是原始 stdout，也不是第二次独立运行 | [core-regression-summary.json](tests/desktop-evidence/core-regression-summary.json) |
| 原生默认启动专项 | W1/W2 与包清单 PASS：独立 T计划 窗口、WebView2 子进程、默认监听端口 0、新增独立 Chrome/Edge 进程 0。此运行后续 CDP 连接超时，不能把整次运行称为通过 | [native-1788789573472/native-results.json](tests/desktop-evidence/native-1788789573472/native-results.json) |
| 从最终真实解压 ZIP 启动的原生完整链 | **5 PASS / 0 FAIL**：包内检查、虚拟源断网刷新与保存、真正原生 JSON 往返、关闭后新进程重启、换中文解压目录数据保留；实际运行最终 `384C…DEF8` EXE，确认网络修复没有破坏 Blob 导出 | [native-1788792107503/native-results.json](tests/desktop-evidence/native-1788792107503/native-results.json) |
| 最终宿主网络修复后的限定原生复测 | **2 PASS / 0 FAIL**：实际运行最终 `384C…DEF8` EXE，真实启动→合成备份导入→模拟断网刷新，保持普通状态 4 秒后关闭；62 个 NetLog 事件中连接/发送/意外 URL 均 0 | [network-retest-results.json](tests/desktop-evidence/native-1788791959198/network-retest-results.json)、[netlog-summary.json](tests/desktop-evidence/native-1788791959198/netlog-summary.json) |
| 最终 ZIP 解压完整性 | 根线程逐文件路径、长度、SHA-256 核对 **558/558 PASS**；本验收实际运行 `final-release-extract` 的解压副本，并复制到另一个中文目录再运行 | [final-zip-integrity.json](tests/desktop-evidence/final-zip-integrity.json) |
| 最终安装器独立专项 | 安装器代理对最终 `72B9…609A` 实际执行首次安装、同版本修复、覆盖行为、正常卸载 **4 阶段 PASS**；两次各 558 个载荷哈希匹配最终 `384C…DEF8`，损坏 config 恢复、两份自建文件保留。未启动已安装副本，不等同跨版本升级 | [lifecycle-results.json](tests/installer-evidence/lifecycle-results.json)、[post-uninstall.json](tests/installer-evidence/post-uninstall.json)、[安装器报告](tests/installer-evidence/REPORT.md) |

Chrome 为 152.0.7977.76，Edge 为 152.0.4191.66，均使用真实安装的浏览器程序和独立 context。原生 Fixed Runtime 为 152.0.4191.62。测试主机是 Windows 11，未使用 Windows 10 或全新系统。

UI 回归使用根线程提供的白名单 `127.0.0.1` HTTP 预览，不是 file 直开。原生从内嵌资源返回 `https://tplan.local/index.html`，应用本身不需要 HTTP 监听服务。测试时为隔离子进程加了 CDP 端口；默认启动端口检查在没有该参数时单独执行。

## 新界面与原有内容保留

实际验证了 T计划 品牌、今日/本周/看板/记录/周总结五导航、蓝白卡片与 390px 响应式页面。课程弹窗三标签的点击、左右键和 Home/End、aria 状态与隐藏面板通过；保存学习计划回计划标签，保存实际成果回课堂记录标签。

同周同门课程不同日期、同门课程不同周独立保存；学习计划与实际成果双向编辑互不覆盖。课程历史按名称筛选、倒序打开原课次，复制文本包含主题、实际成果、证据与卡点；相关任务入口只维护一个原关联任务。空计划不编造知识，不会自动创建学习成果或实际分钟。

原回归脚本保持原件，适配副本只增加三标签切换与新版标题/单文件入口，不删业务断言。见 [回归适配脚本](tests/tplan-regression.cjs)、[V1.2 适配记录](tests/desktop-evidence/regression-v12/adapter-manifest.json)、[饼图适配记录](tests/desktop-evidence/regression-pie/adapter-manifest.json)。首次 HTTP 全量回归后仅导出 toast 改为“已发起导出，请确认备份文件已保存”；最终原生导出链测的是该诚实提示版本。

## 原生导出、持久化与隔离

原生保存使用真正的 Windows SaveFileDialog。测试在保存框出现后等待 **3 秒**，接受默认文件名和默认 Documents 位置，观察下载完成；随后仅收集本轮新增、时间符合、**完整 state 等于合成 fixture** 的那一份 JSON。最终 ZIP 对应的真实文件被实际用于清空→导入→损坏拒绝→新进程重启，见 [native-roundtrip.json](tests/desktop-evidence/native-1788792107503/native-roundtrip.json)。

保存框自定义文件名控件未能可靠自动定位，该子项为 **NOT RUN（自动化限制）**。没有以模拟下载替代原生保存；Playwright CDP 默认下载管理会接管宿主事件，测试通过 `noDefaults:true` 并恢复浏览器默认下载行为，让原生保存框接管。中间的自动化校准失败日志保留，不改写成 PASS。

另有 3 份校准期间落在默认 Documents 目录的文件，均经过创建时间、匹配运行和完整合成内容核验，才以精确 `Move-Item -LiteralPath` 收集进证据目录。见 [collection.json](tests/desktop-evidence/collected-default-exports/collection.json)。没有读取或移动其他用户 JSON。

收尾按这 3 份文件及两次成功原生链的精确源路径复查：**5/5 已从默认 Documents 位置移入对应证据目录**，源路径不存在、证据文件存在，见 [export-cleanup-final.json](tests/desktop-evidence/export-cleanup-final.json)。

软件换解压位置后仍使用同一个隔离 profile 和虚拟 origin；整个 state 与原值一致。发行包没有 Profile、Local Storage、测试记录、个人 PDF、附件或验收截图；合成数据都留在包外。浏览器旧数据不会凭品牌变更自动进入原生 profile，应通过 JSON 明确导入。

## 网络缺陷与复测记录

在旧候选 EXE SHA-256 `8F5757A1E50D5AF99F191F0A6C464AB890069E68527AD41A70902A3D52B4ED4F` 上，一次独立短窗口 NetLog 捕获了 255 个事件。源码中包含空格的 `--host-resolver-rules=MAP * ~NOTFOUND` 没有正确引用，实际浏览器命令行只保留 `--host-resolver-rules=MAP`。

WebView2 对虚拟域名产生预连接，向已有系统代理发出了 5 次 `CONNECT tplan.local:443`，并收到 `200 Connection established`。另一个 IPv6 可达性 UDP 探测返回 `net_error=-109`；不能据此声称成功向该 IPv6 地址传输了数据。未观察到学习内容发送，但预连接已不符合禁止网络请求边界。应用层 request 日志中没有外部 URL，不能用于否定浏览器网络服务层的实测。

确定缺陷已反馈根线程，见 [network-finding.json](tests/desktop-evidence/network-finding.json) 和 [原始 NetLog](tests/desktop-evidence/native-1788791117208/netlog.json)。原候选哈希不应当作通过严格网络验收的最终包。

根线程随后正确引用 resolver 规则，并在应用子进程参数中关闭代理与 QUIC；没有修改系统全局网络配置。修复候选 `B5C7E65AE5EEA4B816994F3A5BA8FAE8DCFFEA61A4527B30881B94E547E30827` 已执行一次限定复测：N1 原生启动、导入、已加载断网刷新 **PASS**。82 个 NetLog 事件中，真正 TCP 连接、代理隧道、请求/字节发送、DNS query 均为 0；实际完整引用参数断言通过。见 [修复复测结果](tests/desktop-evidence/native-1788791688557/network-retest-results.json)、[网络明细](tests/desktop-evidence/native-1788791688557/network-detail.json)。

N2“连所有 socket connect 调用也必须为 0”的额外强检查仍 **FAIL**，因为还出现一个 1 毫秒后返回 `-109` 的 UDP 可达性检查。不能把这一失败改成已外发数据的证明：[Microsoft Winsock 文档](https://learn.microsoft.com/en-us/windows/win32/api/winsock2/nf-winsock2-connect)说明，UDP 的 connect 只是设置后续发送/接收使用的默认目标地址。本次没有捕获对应发送事件。原代理请求缺陷已消失，但操作系统全层面无网络活动仍 **NOT VERIFIED**；该限制与产品业务通过分开报告。

继续核对 [Chromium 官方 MappedHostResolver 实现](https://raw.githubusercontent.com/chromium/chromium/main/net/dns/mapped_host_resolver.cc)后，失败哨兵修正为 `^NOTFOUND`。候选 `B0C7C01EA51481FC164EDC8A58F7AC02005E9A526B828B015AB8456BFDB45BDE` 再次限定复测 **2 PASS / 0 FAIL**，启动全程 62 个 NetLog 事件中，TCP/UDP 连接起始 **0**、请求/隧道/字节发送 **0**、意外 URL **0**。N1 同时验证真实原生启动、合成备份导入和已加载断网刷新。见 [通过的复测结果](tests/desktop-evidence/native-1788791862032/network-retest-results.json)、[通过的 NetLog 明细](tests/desktop-evidence/native-1788791862032/netlog-summary.json)。这解决了前述强门槛失败；前两轮 FAIL 原件没有删除或改写。

最终宿主又明确设置官方 `IsCustomCrashReportingEnabled=true`，实际命令行出现 `--edge-webview-disable-crash-reporting=1`。**最终 EXE SHA-256：`384C3BA306B8043A795F3A9A3DB418A31320D81FC214063FDD94C14D97E7DEF8`。** 对这一哈希的最后限定运行仍 **2 PASS / 0 FAIL**、62 事件、连接/发送/意外 URL 均 0，见上表最终复测行。没有刻意触发应用崩溃，没有改动 Windows 全局诊断、代理、防火墙或网络设置；此短窗口证据不代表所有系统组件、所有机器和无限期运行绝对零流量。

同次补充采集中，owned HWND 的 PrintWindow 截图取得，但之后额外 records 点击超时，未再次循环诊断。该补充交互不能称为 PASS；其前面的完整原生链路结果保持原始记录，不混合计数。

## 图片与尚未执行范围

以下图片均为合成验收数据，可用来检查布局：

- [1440px 今日](tests/desktop-evidence/regression-v12/chrome-1440-today.png)、[390px 今日](tests/desktop-evidence/regression-v12/chrome-390-today.png)。
- [桌面课堂记录](tests/desktop-evidence/regression-v12/chrome-desktop-course-record.png)、[390px 课堂记录](tests/desktop-evidence/regression-v12/chrome-390-course-record.png)。
- [最终 ZIP 原生窗口内容](tests/desktop-evidence/native-1788792107503/native-populated-today.png)、[最终 ZIP 换解压位置后的看板](tests/desktop-evidence/native-1788792107503/native-moved-dashboard.png)。
- [含 OS 标题栏的 owned 窗口](tests/desktop-evidence/native-1788791117208/native-owned-window.png)：按本次 PID/HWND 限定获取，没有截其他应用；受 DPI/PrintWindow 限制，图像有裁切，只用于确认原生标题栏，不作为整窗排版证据。

明确 **NOT RUN / NOT VERIFIED**：HTML 浏览器 file 直开、操作系统物理断网首次启动、Windows 10 ACL 分支实跑、缺 .NET 的干净机器、跨版本安装升级、运行中修复安装、默认目录可见安装向导、自定义导出文件名输入，以及 Android 原生包。390px 浏览器截图不能当作 Android 已实现的证据；安装包尚未进行代码签名。

历史报告及失败证据保留。本验收未因实现者说“已测试”就把尚未运行的检查写成 PASS；根线程与安装器代理的证据在表中单独署明来源。

## 最终文件对应

验收代理独立读取了最终运行源码、单文件、EXE、ZIP 和安装器，记录长度与 SHA-256，见 [final-manifest.json](tests/desktop-evidence/final-manifest.json)。另只读提取最终 EXE 的 `TPlan.index.html` 程序集资源，没有执行入口，其 SHA-256 与单文件逐字节一致，见 [embedded-resource-verification.json](tests/desktop-evidence/embedded-resource-verification.json)。运行源码 8 个文件与数据核心未因最后网络修复变更。主要产物如下：

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `T计划_V1.3_单文件.html` | 225833 | `42FCA5EB8AF0ACB68F000BBEF4D3DAEFD403429E709224C0767FAE4F864C6416` |
| `T计划.exe` | 419840 | `384C3BA306B8043A795F3A9A3DB418A31320D81FC214063FDD94C14D97E7DEF8` |
| `T计划_1.3.0_Windows_x64_便携版.zip` | 385309977 | `5E6E8544A3243F1B6A90EDA1FBB3792E54F64356ADEE190DF5584BC6A723F15F` |
| `T计划_Setup_1.3.0_x64.exe` | 277514642 | `72B9949C16EBECD74C0AED771DB8E35F532C0CD1E78A2A27D49F2C302ACC609A` |

最终安装器已按同一 EXE 构建完成，验收代理独立读取文件核对了上表 SHA-256，并读取安装器代理 22:52:19 的最终生命周期 JSON 及 22:53:08 的卸载后复查 JSON：均明确绑定最终包，四阶段 PASS，卸载注册项已清除、两份自建文件保留。其测试是安装器代理的独立执行，不能说成验收代理再次运行了一遍。旧 `9532…1523` 安装器和旧生命周期记录归档 `tests/installer-evidence/attempt-2/`，不作为本轮最终交付物。
