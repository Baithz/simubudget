@echo off
setlocal
cd /d "%~dp0\.."
echo [SimuBudget] Verification TypeScript...
call npm run type-check || exit /b 1
echo [SimuBudget] Tests Rust...
call npm run test:rust || exit /b 1
echo [SimuBudget] Build Windows Tauri...
call npm run build || exit /b 1
echo.
echo Build termine. Verifiez les installateurs dans :
echo src-tauri\target\release\bundle\nsis\
echo src-tauri\target\release\bundle\msi\
endlocal
