@echo off
del /q git_out.txt 2>nul
(
echo === branch rename to main ===
git branch -M main
echo.
echo === staging ===
git add -A
echo.
echo === FILES THAT WILL BE COMMITTED (count) ===
git diff --cached --name-only | find /c /v ""
echo.
echo === SANITY: any .env or node_modules leaked? ===
git diff --cached --name-only | findstr /i /c:".env$" /c:".env.local" /c:"node_modules" /c:".next/" /c:"ids.txt"
echo   ^ if nothing listed above, secrets are excluded ^)
echo.
echo === total staged size ===
git diff --cached --stat | findstr /c:"files changed"
) > git_out.txt 2>&1
echo DONE >> git_out.txt
