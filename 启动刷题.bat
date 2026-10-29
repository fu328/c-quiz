@echo off
chcp 65001 >nul
title C 语言刷题助手
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [!] 没有检测到 Node.js
  echo       请先安装 Node.js 20 或更高版本：https://nodejs.org/
  echo       安装完成后重新双击本文件即可。
  echo.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo   首次运行，正在准备运行环境，请稍候...
  echo.
  where pnpm >nul 2>nul
  if errorlevel 1 (
    call npm install
    call npm run build
  ) else (
    call pnpm install
    call pnpm build
  )
  if not exist "dist\index.html" (
    echo.
    echo   [!] 构建失败，请检查上面的错误信息，或改用「pnpm dev」开发模式。
    pause
    exit /b 1
  )
)

node server.mjs
echo.
echo   服务已停止。
pause
