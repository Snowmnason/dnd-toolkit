; Custom NSIS script to delete user data on uninstall
; This cleans up AppData folders for DnD Toolkit

!macro customUnInstall
  ; Delete AppData\Roaming\dnd-toolkit (user settings, cache, storage)
  RMDir /r "$APPDATA\dnd-toolkit"
  
  ; Delete AppData\Local\dnd-toolkit (cached data)
  RMDir /r "$LOCALAPPDATA\dnd-toolkit"
  
  ; Delete window-state.json from userData
  Delete "$APPDATA\DnD-Toolkit\window-state.json"
  
  ; Try to remove the userData folder (only if empty)
  RMDir "$APPDATA\DnD-Toolkit"
!macroend
