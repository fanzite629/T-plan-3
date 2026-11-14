#define PackageDir SourcePath + "\package"
[Setup]
AppId={{BCBB15D5-6A88-4169-B924-248057B30DB3}
AppName=T计划 v3
AppVersion=3.8.0
DefaultDirName={localappdata}\Programs\TPlanV3
DefaultGroupName=T计划 v3
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
OutputDir=release
OutputBaseFilename=TPlan_v3_Setup_3.8.0_x64
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\T计划 v3.exe
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
[Files]
Source: "{#PackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Tasks]
Name: desktopicon; Description: "创建桌面快捷方式"
[Icons]
Name: "{group}\T计划 v3"; Filename: "{app}\T计划 v3.exe"
Name: "{userdesktop}\T计划 v3"; Filename: "{app}\T计划 v3.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\T计划 v3.exe"; Description: "打开 T计划 v3"; Flags: postinstall nowait skipifsilent unchecked
