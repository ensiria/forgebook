@echo off
rem The bench kit's launcher on Windows: double-click it. It starts start-bench.ps1 beside it, which installs what the
rem benchmark needs in the user's own folder (no administrator rights) and runs it.
chcp 65001 >nul
rem A short title: Node reading the long one Windows gives this window can fail an assertion in libuv and die
title Benchmark di Forgebook
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bench.ps1" %*
