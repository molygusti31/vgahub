Option Explicit

Dim shell, fileSystem, appDirectory, managerPath, portPath, logPath
Dim port, url, attempt, request, ready

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
appDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
managerPath = fileSystem.BuildPath(appDirectory, "Manager.exe")
portPath = fileSystem.BuildPath(appDirectory, "manager.port")
logPath = fileSystem.BuildPath(appDirectory, "manager.log")

If Not fileSystem.FileExists(managerPath) Then
  Fail "Manager.exe tidak ditemukan. Ekstrak ulang paket Dashboard-Windows.zip."
End If
If Not fileSystem.FolderExists(fileSystem.BuildPath(appDirectory, "control-center")) Then
  Fail "Folder control-center tidak ditemukan. Ekstrak ulang paket Dashboard-Windows.zip."
End If

shell.CurrentDirectory = appDirectory
ready = False
If fileSystem.FileExists(portPath) Then
  port = ReadPort()
  ready = IsManagerReady(port)
End If

If Not ready Then
  If fileSystem.FileExists(portPath) Then fileSystem.DeleteFile portPath, True
  shell.Run Quote(managerPath) & " --manager", 0, False

  For attempt = 1 To 60
    WScript.Sleep 250
    port = ReadPort()
    If port <> "" Then
      If IsManagerReady(port) Then
        ready = True
        Exit For
      End If
    End If
  Next
End If

If Not ready Then
  Fail "Pengelola dashboard gagal dijalankan. Periksa log: " & logPath
End If

url = "http://127.0.0.1:" & port & "/control-center/"
shell.Run url, 1, False
WScript.Quit 0

Function ReadPort()
  Dim file, value
  ReadPort = ""
  If Not fileSystem.FileExists(portPath) Then Exit Function
  On Error Resume Next
  Set file = fileSystem.OpenTextFile(portPath, 1, False)
  If Err.Number = 0 Then
    value = Trim(file.ReadAll)
    file.Close
    If IsNumeric(value) Then
      If CLng(value) >= 1 And CLng(value) <= 65535 Then ReadPort = CStr(CLng(value))
    End If
  End If
  Err.Clear
  On Error GoTo 0
End Function

Function IsManagerReady(managerPort)
  Dim http
  IsManagerReady = False
  If managerPort = "" Then Exit Function
  On Error Resume Next
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.SetTimeouts 500, 500, 500, 1000
  http.Open "GET", "http://127.0.0.1:" & managerPort & "/api/state", False
  http.Send
  If Err.Number = 0 Then IsManagerReady = (http.Status = 200)
  Err.Clear
  On Error GoTo 0
End Function

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function

Sub Fail(message)
  MsgBox message, vbCritical, "Dashboard Timbangan"
  WScript.Quit 1
End Sub
