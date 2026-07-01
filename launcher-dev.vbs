' WatchHQ Dev Mode Launcher
' Starts Vite dev server + Electron, no terminal windows shown

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\m_oya\Desktop\WatchHQ"

' Start the full dev server (Vite + Electron) in hidden window
shell.Run "cmd /c npm run electron:dev", 0, False
