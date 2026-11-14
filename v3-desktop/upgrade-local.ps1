$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$dest='D:\Soft\TPlanV3'
$exe=Join-Path $dest 'T计划 v3.exe'
$built=Join-Path $root 'package\T计划 v3.exe'
if((Get-Item -LiteralPath $built).VersionInfo.FileVersion -ne '3.12.0.0'){throw '待安装文件不是已验收的 3.12.0 版'}
$qa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\layered-qa-results.json') -Raw | ConvertFrom-Json
if($qa.errors.Count -ne 0 -or $qa.checks.Count -ne 17){throw '桌面验收没有完整通过'}
if($qa.exeSha256 -ne (Get-FileHash -LiteralPath $built).Hash){throw '程序与验收时的文件不一致，请先重新验收'}
$sideQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\sidebar-qa-results.json') -Raw | ConvertFrom-Json
if($sideQa.errors.Count -ne 0 -or $sideQa.checks.Count -ne 13 -or $sideQa.exeSha256 -ne $qa.exeSha256){throw '侧栏验收未通过或与程序版本不一致'}
$assistantQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\assistant-qa-results.json') -Raw | ConvertFrom-Json
if($assistantQa.errors.Count -ne 0 -or $assistantQa.checks.Count -ne 12 -or $assistantQa.exeSha256 -ne $qa.exeSha256){throw 'AI 提议页面验收未通过或与程序版本不一致'}
$treeQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\tree-qa-results.json') -Raw | ConvertFrom-Json
if($treeQa.errors.Count -ne 0 -or $treeQa.checks.Count -ne 14 -or $treeQa.exeSha256 -ne $qa.exeSha256){throw '决策树验收未通过或与程序版本不一致'}
$weekQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\week-home-qa-results.json') -Raw | ConvertFrom-Json
if($weekQa.errors.Count -ne 0 -or $weekQa.checks.Count -ne 14 -or $weekQa.exeSha256 -ne $qa.exeSha256){throw '本周与首页验收未通过或与程序版本不一致'}
$reviewQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\review-sections-qa-results.json') -Raw | ConvertFrom-Json
if($reviewQa.errors.Count -ne 0 -or $reviewQa.checks.Count -ne 20 -or $reviewQa.exeSha256 -ne $qa.exeSha256){throw '回看与分区验收未通过或与程序版本不一致'}
$timerQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\timer-order-qa-results.json') -Raw | ConvertFrom-Json
if($timerQa.errors.Count -ne 0 -or $timerQa.checks.Count -ne 17 -or $timerQa.exeSha256 -ne $qa.exeSha256){throw '计时与分组排序验收未通过或与程序版本不一致'}
# Native timer UI and the 3.9 model runs remain historical evidence. This release
# changes companion animation; gate its current native tests without relabelling old reports.
$petQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\companion-qa-results.json') -Raw | ConvertFrom-Json
if($petQa.errors.Count -ne 0 -or $petQa.checks.Count -ne 14 -or $petQa.exeSha256 -ne $qa.exeSha256){throw '桌宠集成验收未通过或与程序版本不一致'}
$motionCore=Get-Content -LiteralPath (Join-Path $root 'output\motion\core-results.json') -Raw | ConvertFrom-Json
if($motionCore.errors.Count -ne 0 -or $motionCore.checks.Count -ne 12 -or $motionCore.motionSourceSha256 -ne (Get-FileHash -LiteralPath (Join-Path $root 'CompanionMotion.cs')).Hash){throw '动画核心验收未通过或源码已变化'}
$motionQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\companion-motion-qa-results.json') -Raw | ConvertFrom-Json
if($motionQa.errors.Count -ne 0 -or $motionQa.checks.Count -ne 12 -or $motionQa.exeSha256 -ne $qa.exeSha256){throw '原生动画集成验收未通过或与程序版本不一致'}
$activityCore=Get-Content -LiteralPath (Join-Path $root 'output\activity\core-results.json') -Raw | ConvertFrom-Json
if($activityCore.errors.Count -ne 0 -or $activityCore.checks.Count -ne 16 -or $activityCore.activitySourceSha256 -ne (Get-FileHash -LiteralPath (Join-Path $root 'CompanionActivity.cs')).Hash){throw '陪伴动作核心验收未通过或源码已变化'}
$activityQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\companion-activity-qa-results.json') -Raw | ConvertFrom-Json
if($activityQa.errors.Count -ne 0 -or $activityQa.checks.Count -ne 16 -or $activityQa.exeSha256 -ne $qa.exeSha256){throw '陪伴动作计时联动验收未通过或与程序版本不一致'}
$smoothCore=Get-Content -LiteralPath (Join-Path $root 'output\smooth\core-results.json') -Raw | ConvertFrom-Json
if($smoothCore.errors.Count -ne 0 -or $smoothCore.checks.Count -ne 19 -or $smoothCore.blendSourceSha256 -ne (Get-FileHash -LiteralPath (Join-Path $root 'CompanionBlend.cs')).Hash){throw '连续过渡核心验收未通过或源码已变化'}
$smoothQa=Get-Content -LiteralPath (Join-Path $root 'output\playwright\companion-smooth-qa-results.json') -Raw | ConvertFrom-Json
if($smoothQa.errors.Count -ne 0 -or $smoothQa.checks.Count -ne 15 -or $smoothQa.exeSha256 -ne $qa.exeSha256){throw '连续过渡集成验收未通过或与程序版本不一致'}
$motionVisual=Get-Content -LiteralPath (Join-Path $root 'output\smooth\native-visual-results.json') -Raw | ConvertFrom-Json
if($motionVisual.errors.Count -ne 0 -or $motionVisual.checks.Count -ne 4 -or $motionVisual.exeSha256 -ne $qa.exeSha256){throw '动画视觉验收未通过或与程序版本不一致'}
$petLive=Get-Content -LiteralPath (Join-Path $root 'output\playwright\companion-live-results.json') -Raw | ConvertFrom-Json
if($petLive.errors.Count -ne 0 -or $petLive.checks.Count -ne 3 -or $petLive.agentSha256 -ne (Get-FileHash (Join-Path $root 'CompanionAgent.cs')).Hash -or $petLive.panelSha256 -ne (Get-FileHash (Join-Path $root 'CompanionPanel.cs')).Hash){throw '桌宠真实模型验收未通过或对话代码已变化'}
$backup=Join-Path $root ('backups\before-companion-smooth-20261114\installed-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $exe -Destination $backup
Copy-Item -LiteralPath (Join-Path $dest 'TPlan-orange-sprout.ico') -Destination $backup
$shortcut='C:\Users\fanzi\Desktop\T计划.lnk'
Copy-Item -LiteralPath $shortcut -Destination $backup
foreach($p in @(Get-Process | Where-Object {$_.Path -eq $exe})){
 if(-not $p.CloseMainWindow()){throw '程序没有响应正常关闭，尚未替换文件'}
 if(-not $p.WaitForExit(10000)){throw '程序仍在退出，尚未替换文件'}
}
$db=Join-Path $env:LOCALAPPDATA 'TPlanV3\tplan.sqlite3'
foreach($name in @('pet-settings.json','pet-chat.json')){
 $local=Join-Path $env:LOCALAPPDATA ('TPlanV3\'+$name)
 if(Test-Path -LiteralPath $local){Copy-Item -LiteralPath $local -Destination $backup}
}
$snapshot=Join-Path $backup 'user-before-3.12.0.sqlite3'
@'
import sqlite3,sys,json,hashlib
source=sqlite3.connect('file:'+sys.argv[1].replace('\\','/')+'?mode=ro',uri=True)
with sqlite3.connect(sys.argv[2]) as destination: source.backup(destination)
assert source.execute('pragma quick_check').fetchone()[0]=='ok'
raw=source.execute("select value from storage where key='tplan.v3'").fetchone()[0]
s=json.loads(raw)
secret=source.execute("select value from storage where key='secret'").fetchone()
summary={'stateSha256':hashlib.sha256(raw.encode()).hexdigest(),'secretSha256':hashlib.sha256((secret[0] if secret else '').encode()).hexdigest(),'tasks':len(s['tasks']),'sessions':len(s['sessions']),'notes':len(s['notes']),'trees':len(s['trees']),'activePhase':(s.get('active') or {}).get('phase')}
with open(sys.argv[3],'w',encoding='utf-8') as f: json.dump(summary,f,ensure_ascii=False,indent=2)
print(json.dumps(summary,ensure_ascii=False))
'@ | python - $db $snapshot (Join-Path $backup 'data-summary-before.json')
if($LASTEXITCODE -ne 0){throw '数据库备份检查失败，尚未替换文件'}
Copy-Item -LiteralPath $built -Destination $exe -Force
$readme=@'
T计划 v3 · 3.12.0 本机桌面版

启动：双击桌面“T计划”，或此目录的“T计划 v3.exe”。
侧栏：与导航一致的黑白灰线稿机器人图标、快速新建、当前计时卡、任务分组折叠和完全隐藏/展开与可记忆的宽度。拖动右边缘调宽，双击恢复默认，Ctrl+B 隐藏或展开。
AI 提议：写目标 → 检查草稿 → 确认写入。输入自动保存，可切换多份草稿，确认前查看新增/调整数量与去向，成功后直接查看安排。本地模板不联网。
决策树：查看分支、修改步骤、预览本段任务。检查点完成后预览结果分支，再确认加入后续任务。删除树或节点时保留已生成任务。
回看：黑白灰统计面板、日期跳转、记录搜索与筛选、直接编辑补记、按范围保存反思、独立 AI 草稿及过期提醒。
分区：在导航栏“我的任务”右侧新建分区，按课程或项目整理任务；支持改名、收起、调序、拖入、批量归类和移除。分区不改变日期，移除后保留任务。
本周：黑白灰每日任务卡、计划与实际时长、独立的本周未定区；支持拖放、自动滚动、直接选日期和撤销移动。
首页：输入区下移，下方显示今日待办和本周未定，点击标题查看任务，点击安排直接选日期。
计时：黑白灰倒计时与状态提示；暂停/继续、延长与结束记录。收尾文字自动存草稿，失败可重试。小窗有标准/紧凑布局、置顶、返回，F8 暂停/继续，Ctrl+Enter 结束填写，Esc 返回。
分组排序：拖动置顶、今天、之后与未定或自定义分区的标题调整位置；也可点标题旁边的菜单，或聚焦拖动柄后用 Alt+上下键。排序不改变任务日期与归属。
桌宠：拖动移动，单击招手，双击聊天，右键控制漫游/跟随/大小/置顶/提醒。收起后从侧栏“桌宠与助理”或托盘找回。
桌宠动作：左右各八帧步行，脚步跟随实际位移；停下回到原图待机。自然眨眼和轻微呼吸默认开启，右键“待机眨眼与呼吸”可关闭。待机完整保留原画，眨眼只修改眼部区域。
陪伴动作：右键“陪伴动作”选择学习写笔记、看书翻页、休息或原图待机。默认跟随计时：开始/继续进入学习，暂停/到时/结束后休息，保存记录后保持休息。手动选择持续到下次计时状态变化，也可关闭“跟随计时自动切换”。三组动作保持原画细节，各四帧循环。
动作衔接：现有帧之间连续混合，动作切换用约 0.24–0.36 秒的短过渡。连续切换从当前画面接上，走路缓缓起步与减速；拖动、打开右键菜单时暂停动画，隐藏后停止动画时钟。人物 PNG 素材全部保留不变。
学习助理：沿用已配置的模型，可结合任务和计时进行问答、拆解和复盘；检查任务草稿后手动确认写入。聊天与偏好保存在本机 pet-chat.json、pet-settings.json。
数据：%LOCALAPPDATA%\TPlanV3\tplan.sqlite3。数据与设置中可导出 JSON。
模型：需自行填写模型名、接口和密钥。密钥由 Windows 当前账户加密，不进入 JSON 导出。
请保留整个软件目录，EXE 依赖同目录 runtime 与 DLL。
'@
[IO.File]::WriteAllText((Join-Path $dest '使用说明.txt'),$readme,(New-Object Text.UTF8Encoding($true)))
# This is the user's interactive app being reopened, not a background helper.
$started=Start-Process -FilePath $exe -WorkingDirectory $dest -WindowStyle Normal -PassThru
Start-Sleep -Seconds 3
if($started.HasExited){throw '新版启动后提前退出，请保留备份并检查'}
$receipt=[ordered]@{version='3.12.0.0';installedAt=[DateTimeOffset]::Now.ToString('o');executable=$exe;sha256=(Get-FileHash -LiteralPath $exe).Hash;backup=$backup;shortcut=$shortcut;pid=$started.Id}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'upgrade-3.12.0.json') -Encoding UTF8
$receipt | ConvertTo-Json
