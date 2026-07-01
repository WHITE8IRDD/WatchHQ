' WatchHQ Silent Launcher
' Launches the app without showing a terminal window

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\m_oya\Desktop\WatchHQ"

' Run Electron in production mode (hidden window, don't wait)
shell.Run "cmd /c npx electron .", 0, False
