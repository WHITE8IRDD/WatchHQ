Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "npx.cmd electron . --remote-debugging-port=9222", 0, False
