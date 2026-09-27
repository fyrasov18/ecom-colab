@echo off
del /q commit2_out.txt 2>nul
(
git add -A -- . ":(exclude)commit2msg.txt"
git -c user.name="Cline" -c user.email="cline@users.noreply.github.com" commit -q -F commit2msg.txt
) > commit2_out.txt 2>&1
echo EXIT=%ERRORLEVEL% >> commit2_out.txt
git --no-pager log --oneline >> commit2_out.txt 2>&1
echo === STATUS === >> commit2_out.txt
git status --short >> commit2_out.txt 2>&1
echo DONE >> commit2_out.txt
