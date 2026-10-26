@echo off
REM ---------------------------------------------------------------------------
REM FoodTech Study - one-click local launcher (Windows)
REM
REM Just double-click start.bat in Explorer, or run it from a terminal:
REM
REM   start.bat
REM
REM It does every first-run setup step for you and then starts the app:
REM   1. checks that Node.js and npm are installed
REM   2. installs dependencies (only the first time)
REM   3. creates your .env file from .env.example (only if missing)
REM   4. creates/updates the local SQLite database
REM   5. starts the dev server and prints the URL to open
REM
REM Every step is safe to run again, so you can just run start.bat each time.
REM ---------------------------------------------------------------------------

setlocal

REM Always work from the folder this script lives in.
cd /d "%~dp0"

set "URL=http://localhost:3000"

echo.
echo   FoodTech Study - starting up...
echo   ---------------------------------

REM 1. Node.js and npm must be available.
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js is not installed. Please install Node.js 22 or newer from
  echo       https://nodejs.org/ and run this again.
  echo.
  goto :fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] npm is not installed. It normally ships with Node.js. Please install
  echo       Node.js 22+ from https://nodejs.org/ and run this again.
  echo.
  goto :fail
)
for /f "delims=" %%v in ('node --version') do set "NODEVER=%%v"
echo   [ok] Node.js %NODEVER% found

REM 2. Install dependencies only when node_modules is missing (fast repeat runs).
if not exist "node_modules" (
  echo   [..] Installing dependencies ^(first run only, this can take a minute^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo   [X] npm install failed. Check your internet connection and try again.
    echo.
    goto :fail
  )
) else (
  echo   [ok] Dependencies already installed
)

REM 3. Create .env from the example only if it does not exist yet.
REM    Never overwrite an existing .env (it may hold your real secrets/API key).
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo   [ok] Created .env from .env.example
  ) else (
    echo.
    echo   [X] .env.example is missing, so .env could not be created. Please
    echo       restore it from the repository.
    echo.
    goto :fail
  )
) else (
  echo   [ok] .env already exists ^(left untouched^)
)

REM 4. Make sure the SQLite database exists and the schema is applied.
REM    If versioned migrations exist, apply them (deploy is idempotent).
REM    Otherwise fall back to db push. Both are safe to run repeatedly.
echo   [..] Setting up the local database...
if exist "prisma\migrations" (
  call npx --yes prisma migrate deploy
) else (
  call npx --yes prisma db push
)
if errorlevel 1 (
  echo.
  echo   [X] Database setup failed. See the message above.
  echo.
  goto :fail
)
echo   [ok] Database is ready

REM 5. Start the app.
REM    We use the development server on purpose:
REM      - it boots fast (no separate build step on every launch), and
REM      - it allows the built-in development session secret, so you do NOT need
REM        to set AUTH_SECRET just to try the app locally.
REM    (For a real deployment, build with `npm run build`, set a real
REM     AUTH_SECRET, and run `npm start` - see the README.)
echo.
echo   Everything is ready. Starting the server...
echo.
echo   ^>^>^> Open %URL% in your browser ^<^<^<
echo.
echo   (AI features are optional and need a free Gemini key - see README.md.
echo    Press Ctrl+C to stop the server.)
echo.

call npm run dev
goto :eof

:fail
endlocal
exit /b 1
