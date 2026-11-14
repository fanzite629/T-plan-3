Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$form=New-Object Windows.Forms.Form
$form.Text='计时悬浮验证 · 另一个应用窗口'
$form.WindowState='Maximized'
$form.BackColor=[Drawing.Color]::FromArgb(224,230,239)
$label=New-Object Windows.Forms.Label
$label.Text='其他应用窗口（仅用于验证悬浮置顶）'
$label.Dock='Fill'
$label.Font=New-Object Drawing.Font('Microsoft YaHei UI',24)
$label.TextAlign='MiddleCenter'
$form.Controls.Add($label)
$form.Add_Shown({$form.Activate()})
[Windows.Forms.Application]::Run($form)
