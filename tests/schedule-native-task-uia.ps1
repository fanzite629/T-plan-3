param([Parameter(Mandatory=$true)][int]$TPlanPid,[switch]$Add,[switch]$Verify)
$ErrorActionPreference='Stop'
if([bool]$Add -eq [bool]$Verify){throw 'Choose exactly one of -Add or -Verify'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
$process=Get-Process -Id $TPlanPid -ErrorAction Stop
if($process.ProcessName -ne 'T计划' -or $process.MainWindowTitle -notmatch '^T计划'){throw 'Expected visible TPlan window'}
$root=[System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
function Nodes {return $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)}
function By-Id([string]$id){foreach($e in (Nodes)){if($e.Current.AutomationId -eq $id){return $e}};throw "Missing input $id"}
function Invoke-Button([string]$name){foreach($e in (Nodes)){if($e.Current.Name -eq $name -and $e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button){$e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Milliseconds 250;return}};throw "Missing button $name"}
function Set-Input([string]$id,[string]$value){$e=By-Id $id;$p=$e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern);$p.SetValue($value);Start-Sleep -Milliseconds 100;$actual=(By-Id $id).GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value;if($actual -ne $value){throw "Input $id did not retain requested value: $actual"}}
function Set-Date([string]$value){
  $parts=$value.Split('-')
  foreach($part in @(@('年 安排日期',$parts[0]),@('月 安排日期',$parts[1]),@('日 安排日期',$parts[2]))){
    $field=$null
    foreach($e in (Nodes)){if($e.Current.Name -eq $part[0] -and $e.Current.ControlType -eq [System.Windows.Automation.ControlType]::Spinner){$field=$e;break}}
    if(-not $field){throw "Missing date segment $($part[0])"}
    $field.SetFocus()
    [System.Windows.Forms.SendKeys]::SendWait($part[1])
  }
  [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
  Start-Sleep -Milliseconds 100
  $actual=(By-Id 'f-date').GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value
  if($actual -ne $value){throw "Date did not retain requested value: $actual"}
}
function All-Text {return ((Nodes)|ForEach-Object {$_.Current.Name}|Where-Object {$_}) -join "`n"}
$title='单片机实验考核准备'
$notes="截止：第10周结束前（2026-11-15）。`n1. 整理实验指导书`n2. 补充实验指导书笔记`n3. 复习所有实验流程`n4. 整理常用程序`n5. 整理常用单片机指令`n6. 梳理实验接线`n7. 总结常见实验故障`n8. 第10周完成一次实验考核模拟"
if($Add){
  $text=All-Text
  if($text.Contains($title)){throw 'Task title already appears in UI; no duplicate created'}
  $dialogOpen=$false
  foreach($e in (Nodes)){if($e.Current.AutomationId -eq 'dialog' -and $e.Current.Name -eq '新建任务'){$dialogOpen=$true;break}}
  if(-not $dialogOpen){Invoke-Button '＋ 新建任务'}
  [void](By-Id 'f-title')
  Set-Input 'f-title' $title
  Set-Date '2026-11-15'
  Set-Input 'f-estimatedMinutes' '0'
  Set-Input 'f-notes' $notes
  Invoke-Button '保存'
  if((All-Text) -match '未保存|保存失败'){throw 'Task UI reports a save failure'}
}
Invoke-Button '本周'
$all=All-Text
if(-not $all.Contains($title)){throw 'Preparation task not visible in complete task list'}
if(-not $all.Contains('2026-11-15')){throw 'Preparation task due date not visible'}
if(-not $all.Contains('整理实验指导书') -or -not $all.Contains('第10周完成一次实验考核模拟')){throw 'Task notes/checklist not visible'}
Write-Output ('PASS native task '+($(if($Add){'created'}else{'verified'}))+'; title, 2026-11-15, checklist visible')
