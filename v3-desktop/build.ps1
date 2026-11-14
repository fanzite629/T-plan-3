$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$out=Join-Path $root 'package'
New-Item -ItemType Directory -Force $out | Out-Null
& (Join-Path $root 'convert-icon.ps1')
$html=[IO.File]::ReadAllText((Join-Path $root 'app.html'))
$html=$html -replace '<link rel="stylesheet" href="https://fonts.googleapis.com/[^>]+>',''
$html=$html.Replace("const KEY='tplan.v3';", "const KEY='tplan.v3';`nconst nativeDB=chrome.webview.hostObjects.sync.database;`nconst desktopStore={getItem:k=>k===KEY?nativeDB.Read(k):nativeDB.ReadSecret(),setItem:(k,v)=>k===KEY?nativeDB.Write(k,v):nativeDB.WriteSecret(v),removeItem:k=>nativeDB.WriteSecret('')};")
$html=$html.Replace('localStorage.','desktopStore.')
$html=$html.Replace('记录保存在这台设备的浏览器里','已保存在本机').Replace('⚠ 浏览器存储不可用，关闭页面后记录会丢失，请导出备份','⚠ 保存失败，请立即导出备份')
$html=$html.Replace('catch(e){storageOK=false;}S=sampleState();','catch(e){alert("数据库读取失败，请先备份数据目录，避免覆盖原记录。");throw e;}S=empty();')
$html=$html.Replace('const ui=S.ui;S.ui=undefined;desktopStore.setItem(KEY,JSON.stringify(S));S.ui=ui;', 'const {ui,...persisted}=S;desktopStore.setItem(KEY,JSON.stringify(persisted));')
function Replace-Required([string]$old,[string]$new) {
 if(-not $script:html.Contains($old)){throw "HTML 构建锚点缺失：$old"}
 $script:html=$script:html.Replace($old,$new)
}
Replace-Required "'documentPictureInPicture' in window" "(nativeMiniTimer || 'documentPictureInPicture' in window)"
Replace-Required 'async function openPip(){' 'async function openPip(){if(nativeMiniTimer){openDesktopMiniTimer();return;}'
Replace-Required 'if(pip)pipUpdate();' "if(pip)pipUpdate();`ndesktopTimerSnapshot();"
$bridge=[IO.File]::ReadAllText((Join-Path $root 'timer-bridge.js'))
$planning=[IO.File]::ReadAllText((Join-Path $root 'planning-ui.js'))
$core=[IO.File]::ReadAllText((Join-Path $root 'planning-core.js'))
$css=[IO.File]::ReadAllText((Join-Path $root 'planning.css'))
$sidebar=[IO.File]::ReadAllText((Join-Path $root 'sidebar.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'sidebar.css'))
$assistant=[IO.File]::ReadAllText((Join-Path $root 'assistant-ui.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'assistant.css'))
$tree=[IO.File]::ReadAllText((Join-Path $root 'tree-ui.js'))
$core+=[IO.File]::ReadAllText((Join-Path $root 'tree-core.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'tree.css'))
$weekHome=[IO.File]::ReadAllText((Join-Path $root 'week-home-ui.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'week-home.css'))
$review=[IO.File]::ReadAllText((Join-Path $root 'review-ui.js'))
$sections=[IO.File]::ReadAllText((Join-Path $root 'sections-ui.js'))
$timer=[IO.File]::ReadAllText((Join-Path $root 'timer-ui.js'))
$groupOrder=[IO.File]::ReadAllText((Join-Path $root 'sidebar-order.js'))
$companion=[IO.File]::ReadAllText((Join-Path $root 'companion-ui.js'))
$core+=[IO.File]::ReadAllText((Join-Path $root 'timer-core.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'timer.css'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'sidebar-order.css'))
$core+=[IO.File]::ReadAllText((Join-Path $root 'sections-core.js'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'review.css'))
$css+=[IO.File]::ReadAllText((Join-Path $root 'sections.css'))
Replace-Required '/* ================= 启动 ================= */' ($bridge+"`n"+$planning+"`n"+$sidebar+"`n"+$assistant+"`n"+$tree+"`n"+$weekHome+"`n"+$review+"`n"+$sections+"`n"+$timer+"`n"+$groupOrder+"`n"+$companion+"`n/* ================= 启动 ================= */")
Replace-Required '</head>' ("<style>"+$css+"</style><script>"+$core+"</script></head>")
$image='data:image/png;base64,'+[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root 'icon-128.png')))
$html=$html.Replace('<span class="logo sm" aria-hidden="true">T</span>',('<img class="logo sm" aria-hidden="true" alt="" src="'+$image+'">'))
$html=$html.Replace('<span class="logo" aria-hidden="true">T</span>',('<img class="logo" aria-hidden="true" alt="" src="'+$image+'">'))
$html=$html.Replace('</style>','img.logo{object-fit:contain;background:transparent;box-shadow:none;border-radius:0}</style>')
[IO.File]::WriteAllText((Join-Path $root 'index.html'),$html,(New-Object Text.UTF8Encoding($false)))
$sdk=Join-Path $root '..\desktop\vendor\sdk'
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$petResources=@(Get-ChildItem -LiteralPath (Join-Path $root 'companion-assets') -Filter '*.png' | ForEach-Object { '/resource:'+ $_.FullName + ',pet.' + $_.Name })
& $csc /nologo /target:winexe /platform:x64 /utf8output "/out:$out\T计划 v3.exe" "/win32icon:$root\icon.ico" "/win32manifest:$root\..\desktop\app.manifest" "/resource:$root\index.html,index" "/resource:$root\icon.ico,icon" @petResources /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll /reference:System.Net.Http.dll "/reference:$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll" "/reference:$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" "$root\App.cs" "$root\MainWindow.cs" "$root\TimerMiniWindow.cs" "$root\AiGateway.cs" "$root\CompanionWindow.cs" "$root\CompanionMotion.cs" "$root\CompanionActivity.cs" "$root\CompanionBlend.cs" "$root\CompanionPanel.cs" "$root\CompanionAgent.cs"
if($LASTEXITCODE -ne 0){throw '编译失败'}
Copy-Item "$sdk\lib\net462\Microsoft.Web.WebView2.*.dll" $out
Copy-Item "$sdk\runtimes\win-x64\native\WebView2Loader.dll" $out
Copy-Item "$root\..\desktop\TPlan.exe.config" "$out\T计划 v3.exe.config"
New-Item -ItemType Directory -Force "$out\licenses" | Out-Null
Copy-Item "$sdk\LICENSE.txt","$sdk\NOTICE.txt","$root\..\desktop\vendor\WebView2-Fixed-Runtime-LICENSE.html" "$out\licenses"
& robocopy "$root\..\desktop\vendor\runtime\Microsoft.WebView2.FixedVersionRuntime.152.0.4191.62.x64" "$out\runtime" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
if($LASTEXITCODE -ge 8){throw '运行组件复制失败'}
exit 0
