param([Parameter(Mandatory=$true)][int]$TPlanPid,[string]$EvidenceRoot='D:\Personal_work_station\Projects\T成长\output\playwright\schedule-20260920\native-uia')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$process=Get-Process -Id $TPlanPid -ErrorAction Stop
if($process.ProcessName -ne 'T计划' -or $process.MainWindowTitle -notmatch '^T计划'){throw 'Only the visible TPlan window can be inspected'}
$root=[System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
New-Item -ItemType Directory -Path $EvidenceRoot -Force|Out-Null
function Get-Names {
  $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  return @($nodes|ForEach-Object {$_.Current.Name}|Where-Object {$_})
}
function Scroll-Course([string]$fragment){
  $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  foreach($node in $nodes){
    if($node.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $node.Current.Name.Contains($fragment)){
      $node.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView()
      Start-Sleep -Milliseconds 200
      return
    }
  }
  throw "Course button missing for scroll: $fragment"
}
function Invoke-Named([string]$name){
  $nodes=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  foreach($node in $nodes){
    if($node.Current.Name -eq $name -and $node.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button){
      $node.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      Start-Sleep -Milliseconds 150
      return
    }
  }
  throw "UI button missing: $name"
}
function Current-Week {
  $line=Get-Names|Where-Object {$_ -match '^2026-\d\d-\d\d — 2026-\d\d-\d\d$'}|Select-Object -First 1
  if(-not $line){throw 'Week range not displayed'}
  return [int](([datetime]::ParseExact($line.Substring(0,10),'yyyy-MM-dd',$null)-[datetime]'2026-09-07').Days/7)+1
}
function Go-Week([int]$week){
  $before=Current-Week
  if($before -gt $week){for($n=$before;$n -gt $week;$n--){Invoke-Named '‹'}}
  if($before -lt $week){for($n=$before;$n -lt $week;$n++){Invoke-Named '›'}}
  if((Current-Week) -ne $week){throw "Navigation failed W$week"}
}
Invoke-Named '本周'
$expect=@{
  3=@('测控软件技术')
  6=@('🧪 分组实验①｜课程名待确认')
  7=@('🧪 分组实验②｜课程名待确认','🧪 分组实验③｜课程名待确认','现代分析仪器及应用','【被实验占用】')
  8=@('🧪 分组实验④｜课程名待确认','🧪 单片机实验')
  9=@('🧪 单片机实验','测控软件技术')
  10=@('🧪 单片机实验','测控软件技术')
  11=@('🔴 单片机实验考核','🧪 电子电路CAD实验','主教239')
  12=@('🧪 电子电路CAD实验','主教239')
  16=@('🧪 电子电路CAD实验','主教239')
}
$results=@()
foreach($week in @(3,6,7,8,9,10,11,12,16)){
  Go-Week $week
  $names=Get-Names
  $all=$names -join "`n"
  foreach($text in $expect[$week]){if(-not $all.Contains($text)){throw "W$week missing $text"}}
  if($all -match '第二组|理论课免上'){throw "W$week includes removed second-group rule"}
  $course=@{3='测控软件技术';6='🧪 分组实验①';7='【被实验占用】';8='🧪 分组实验④';9='🧪 单片机实验';10='🧪 单片机实验';11='🔴 单片机实验考核';12='🧪 电子电路CAD实验';16='🧪 电子电路CAD实验'}[$week]
  Scroll-Course $course
  $picture=Join-Path $EvidenceRoot ("W{0}-native.png" -f $week)
  & (Join-Path $PSScriptRoot 'tplan-window-shot.ps1') -TPlanPid $TPlanPid -OutputPath $picture
  $results+=@{week=$week;status='PASS';visibleMatches=$expect[$week];screenshot=$picture}
  Write-Output ("PASS W{0}" -f $week)
}
$report=Join-Path $EvidenceRoot 'report.json'
[IO.File]::WriteAllText($report,($results|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
Write-Output ("Evidence: "+$report)
