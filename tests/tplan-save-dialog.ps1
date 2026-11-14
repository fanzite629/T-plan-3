param([Parameter(Mandatory=$true)][int]$TPlanPid,[Parameter(Mandatory=$true)][string]$OutputPath,[Parameter(Mandatory=$true)][string]$EvidenceRoot,[switch]$UseDefault)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TPlanDialogNative {
 public delegate bool WindowCallback(IntPtr handle,IntPtr parameter);
 [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback,IntPtr parameter);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent,WindowCallback callback,IntPtr parameter);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr handle);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr handle);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SetWindowText(IntPtr handle,string text);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr handle,uint message,IntPtr wparam,IntPtr lparam);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr handle);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
 [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr handle);
 [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a,uint b,bool attach);
 [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle,System.Text.StringBuilder text,int count);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr handle,System.Text.StringBuilder text,int count);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string cls,string title);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
'@
$targetPath=[IO.Path]::GetFullPath($OutputPath)
$allowedRoot=[IO.Path]::GetFullPath($EvidenceRoot)
if(-not $targetPath.StartsWith($allowedRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Export destination outside isolated acceptance evidence'}
$deadline=[DateTime]::UtcNow.AddSeconds(30)
$handle=[IntPtr]::Zero
do {
 $candidate=[TPlanDialogNative]::FindWindow('#32770','导出 T计划 数据')
 if($candidate -ne [IntPtr]::Zero){
  [uint32]$owner=0
  [void][TPlanDialogNative]::GetWindowThreadProcessId($candidate,[ref]$owner)
  if($owner -eq $TPlanPid){$handle=$candidate;break}
 }
 Start-Sleep -Milliseconds 200
} while([DateTime]::UtcNow -lt $deadline)
if($handle -eq [IntPtr]::Zero){
 $ownedWindows=[Collections.Generic.List[string]]::new()
 [void][TPlanDialogNative]::EnumWindows([TPlanDialogNative+WindowCallback]{param($h,$p)
  [uint32]$windowOwner=0
  [void][TPlanDialogNative]::GetWindowThreadProcessId($h,[ref]$windowOwner)
  if($windowOwner -eq $TPlanPid){$caption=[Text.StringBuilder]::new(512);$class=[Text.StringBuilder]::new(512);[void][TPlanDialogNative]::GetWindowText($h,$caption,512);[void][TPlanDialogNative]::GetClassName($h,$class,512);$ownedWindows.Add($class.ToString()+' | '+$caption.ToString())}
  return $true
 },[IntPtr]::Zero)
 Write-Output ($ownedWindows | ConvertTo-Json -Compress)
 throw 'Owned native SaveFileDialog not found'
}
$dialog=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
# The user may consider the filename before saving; exceed the app's 1s Blob revoke timer.
Start-Sleep -Seconds 3
if(-not $UseDefault){
$editType=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
$edits=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,$editType)
$field=$null
foreach($edit in $edits){if($edit.Current.AutomationId -eq '1001' -or $edit.Current.Name -match '文件名|File name'){$field=$edit;break}}
if($null -ne $field){
 $valuePattern=$null
 if(-not $field.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$valuePattern) -or $valuePattern.Current.IsReadOnly){$field=$null}
}
if($null -eq $field){
 foreach($control in $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)){
  if($control.Current.Name -match '文件名|File name'){
   $pattern=$null
   if($control.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern) -and -not $pattern.Current.IsReadOnly){$field=$control;break}
  }
 }
}
if($null -eq $field){
 $nativeEdits=[Collections.Generic.List[object]]::new()
 [void][TPlanDialogNative]::EnumChildWindows($handle,[TPlanDialogNative+WindowCallback]{param($h,$p)
  $class=[Text.StringBuilder]::new(256);[void][TPlanDialogNative]::GetClassName($h,$class,256)
  if($class.ToString() -match 'Edit|Rich'){$caption=[Text.StringBuilder]::new(1024);[void][TPlanDialogNative]::GetWindowText($h,$caption,1024);$nativeEdits.Add([pscustomobject]@{Handle=$h;Class=$class.ToString();Id=[TPlanDialogNative]::GetDlgCtrlID($h);ParentId=[TPlanDialogNative]::GetDlgCtrlID([TPlanDialogNative]::GetParent($h));IsDefaultFilename=$caption.ToString() -match '^T计划_数据备份_\d{8}-\d{6}\.json$'})}
  return $true
 },[IntPtr]::Zero)
 $filenameEdit=@($nativeEdits | Where-Object {$_.IsDefaultFilename})
 if($filenameEdit.Count -eq 0){$filenameEdit=@($nativeEdits | Where-Object {$_.Id -eq 1001})}
 if($filenameEdit.Count -eq 0){$filenameEdit=@($nativeEdits | Where-Object {$_.Id -eq 1148 -or $_.ParentId -eq 1148})}
 if($filenameEdit.Count -eq 0 -and $nativeEdits.Count -eq 1){$filenameEdit=@($nativeEdits[0])}
 if($filenameEdit.Count -ne 1){Write-Output ($nativeEdits | Select-Object Class,Id,ParentId,IsDefaultFilename | ConvertTo-Json -Compress);throw 'Filename edit field not uniquely identified inside owned dialog'}
 [uint32]$focusOwner=0
 [void][TPlanDialogNative]::GetWindowThreadProcessId($filenameEdit[0].Handle,[ref]$focusOwner)
 if($focusOwner -ne $TPlanPid){throw 'Filename input target changed process'}
 # Deliver Unicode character input only to this owned Edit. WM_SETTEXT alone does
 # not update the modern Shell dialog's chosen FileName model on this machine.
 [void][TPlanDialogNative]::SendMessage($filenameEdit[0].Handle,0x00B1,[IntPtr]::Zero,[IntPtr](-1))
 foreach($character in $targetPath.ToCharArray()){[void][TPlanDialogNative]::SendMessage($filenameEdit[0].Handle,0x0102,[IntPtr]([int]$character),[IntPtr]1)}
 $readBack=[Text.StringBuilder]::new(32768);[void][TPlanDialogNative]::GetWindowText($filenameEdit[0].Handle,$readBack,32768)
 if($readBack.ToString() -ne $targetPath){throw ('Native filename field does not match isolated destination: '+$readBack.ToString())}
}else{$field.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($targetPath)}
}
$saveType=[System.Windows.Automation.AndCondition]::new(
 [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button),
 [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1'))
$save=$dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$saveType)
if($null -eq $save){
 $nativeSave=[Collections.Generic.List[object]]::new()
 [void][TPlanDialogNative]::EnumChildWindows($handle,[TPlanDialogNative+WindowCallback]{param($h,$p)
  $class=[Text.StringBuilder]::new(256);[void][TPlanDialogNative]::GetClassName($h,$class,256)
  if($class.ToString() -eq 'Button' -and [TPlanDialogNative]::GetDlgCtrlID($h) -eq 1){$nativeSave.Add($h)}
  return $true
 },[IntPtr]::Zero)
 if($nativeSave.Count -ne 1){throw 'Native save button IDOK was not uniquely identified'}
 [void][TPlanDialogNative]::SendMessage($nativeSave[0],0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)
}
else{$save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()}
$closeDeadline=[DateTime]::UtcNow.AddSeconds(10)
while([TPlanDialogNative]::IsWindow($handle) -and [DateTime]::UtcNow -lt $closeDeadline){Start-Sleep -Milliseconds 100}
if([TPlanDialogNative]::IsWindow($handle)){throw 'Save invocation did not close owned dialog'}
Write-Output 'Owned native save dialog completed.'
