; T计划 Windows x64 每用户离线安装器。
; 只编译 desktop/out/TPlan-1.9.1-release 中明确列出的发布文件。
; 不递归项目根目录，不使用 external/download，也不访问旧用户数据。
; 构建前须由 build 脚本准备完整 out 包；本脚本不会补下载依赖。
; 固定 AppId 用于后续同应用升级，不能每次发布重新生成。

#define AppName "T计划"
#define AppVersion "1.9.1"
#define AppExeName "T计划.exe"
#define PackageDir SourcePath + "\out\TPlan-1.9.1-release"
#ifndef ReleaseAppId
  #define ReleaseAppId "{{8D7F04BB-63BB-4F5F-B13E-18BB44834B1C}"
#endif

#if !FileExists(PackageDir + "\" + AppExeName)
  #error "Missing TPlan package: build desktop/out/TPlan-win-x64 first."
#endif
#if !FileExists(PackageDir + "\runtime\msedgewebview2.exe")
  #error "Missing bundled Fixed Runtime: runtime/msedgewebview2.exe is required."
#endif
#if !FileExists(PackageDir + "\licenses\WebView2-Fixed-Runtime-LICENSE.txt")
  #error "Missing plain-text Microsoft Fixed Runtime license."
#endif

[Setup]
AppId={#ReleaseAppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppName}
DefaultDirName={localappdata}\Programs\TPlan
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
SourceDir={#PackageDir}
OutputDir={#SourcePath}\..\releases
OutputBaseFilename=T计划_Setup_{#AppVersion}_x64
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
LicenseFile={#PackageDir}\licenses\WebView2-Fixed-Runtime-LICENSE.txt
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
DisableDirPage=no
UsePreviousAppDir=yes
AllowUNCPath=no
AllowNetworkDrive=no
; 不声明用户 Profile/data 目录；卸载只移除安装器记录的程序文件。
; 不添加 UninstallDelete / InstallDelete，避免删除用户创建的文件。

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："

[Files]
Source: "{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#AppExeName}.config"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "licenses\*"; DestDir: "{app}\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "使用说明.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Check: not WizardNoIcons
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "打开 {#AppName}"; WorkingDir: "{app}"; Flags: postinstall nowait skipifsilent unchecked

[Messages]
WindowsVersionNotSupported=T计划需要 Windows 10 或 Windows 11 x64。本机系统版本不受支持，安装已停止。
WinVersionTooLowError=T计划需要 %1 %2 或更高版本。安装程序不会自动下载系统组件。
SetupWindowTitle=安装 - %1
WelcomeLabel1=欢迎安装 [name]
WelcomeLabel2=安装程序将为当前 Windows 用户安装 [name/ver]。%n%n应用随包提供运行组件，安装过程无需联网。%n%n升级和卸载会保留本机学习数据。
ClickNext=请单击“下一步”继续，或单击“取消”退出安装。
ButtonBack=< 上一步(&B)
ButtonNext=下一步(&N) >
ButtonInstall=安装(&I)
ButtonCancel=取消
ButtonFinish=完成(&F)
SelectDirLabel3=安装程序将把 [name] 安装到以下文件夹。
SelectDirBrowseLabel=单击“下一步”继续，或单击“浏览”选择其他本机文件夹。
ButtonBrowse=浏览(&B)...
ReadyLabel1=现在可以在电脑上安装 [name]。
ReadyLabel2a=单击“安装”开始安装，或单击“上一步”检查设置。
WizardLicense=Microsoft 运行组件许可
LicenseLabel=请阅读以下 Microsoft WebView2 Fixed Runtime 许可。
LicenseLabel3=请阅读完整条款。若接受条款，可继续安装；若不接受，请取消安装。
LicenseAccepted=我接受协议(&A)
LicenseNotAccepted=我不接受协议(&D)
WizardSelectDir=选择安装位置
WizardSelectTasks=选择快捷方式
WizardReady=准备安装
WizardInstalling=正在安装
FinishedHeadingLabel=完成 [name] 安装
FinishedLabel=已安装 [name]。学习数据保存在当前用户的本机目录，卸载程序不会清除这些数据。
ClickFinish=单击“完成”退出安装程序。

[Code]
function InitializeSetup: Boolean;
begin
  Result := IsDotNetInstalled(net48, 0);
  if not Result then
    SuppressibleMsgBox(
      'T计划需要 .NET Framework 4.8 或更高版本。' + #13#10 +
      '这台电脑尚未满足运行条件，安装已停止。' + #13#10 +
      '请先完成 Windows/.NET 运行环境准备，再运行本安装包。' + #13#10 +
      '安装程序不会联网下载组件，也不会修改已有学习数据。',
      mbError, MB_OK, IDOK);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  SelectedDir, DataDir: String;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    SelectedDir := AddBackslash(ExpandFileName(WizardDirValue));
    DataDir := AddBackslash(ExpandFileName(ExpandConstant('{localappdata}\TPlan')));
    if (CompareText(Copy(SelectedDir, 1, Length(DataDir)), DataDir) = 0) or
      (CompareText(Copy(DataDir, 1, Length(SelectedDir)), SelectedDir) = 0) then
    begin
      SuppressibleMsgBox(
        '请选择程序安装文件夹，例如默认的 LocalAppData\Programs\TPlan。' + #13#10 +
        'LocalAppData\TPlan 是学习数据目录，不能作为程序安装位置。',
        mbError, MB_OK, IDOK);
      Result := False;
    end;
  end;
end;

procedure GrantRuntimeReadExecute(const RuntimeDir, PackageSid: String);
var
  ExitCode: Integer;
begin
  // Only the resolved {app}\runtime directory is passed to icacls.
  // Grant additive RX permission; never reset ACLs or grant write/full access.
  if not Exec(ExpandConstant('{sys}\icacls.exe'),
    '"' + RuntimeDir + '" /grant "*' + PackageSid + ':(OI)(CI)(RX)"',
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    RaiseException('无法为 T计划运行组件设置 Windows 10 所需权限。请重试安装。');
  if ExitCode <> 0 then
    RaiseException('T计划运行组件权限设置失败，错误码：' + IntToStr(ExitCode) + '。请重试安装。');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Version: TWindowsVersion;
  RuntimeDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    GetWindowsVersionEx(Version);
    if (Version.Major = 10) and (Version.Build < 22000) then
    begin
      RuntimeDir := AddBackslash(ExpandFileName(ExpandConstant('{app}'))) + 'runtime';
      if not FileExists(AddBackslash(RuntimeDir) + 'msedgewebview2.exe') then
        RaiseException('T计划运行组件未完整安装，无法完成 Windows 10 权限设置。');
      // Microsoft Fixed Runtime v120+ documented AppContainer SIDs.
      // https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution
      GrantRuntimeReadExecute(RuntimeDir, 'S-1-15-2-2');
      GrantRuntimeReadExecute(RuntimeDir, 'S-1-15-2-1');
    end;
  end;
end;
