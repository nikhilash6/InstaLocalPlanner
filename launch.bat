@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_CMD="
where py >nul 2>nul && set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
    where python >nul 2>nul && set "PYTHON_CMD=python"
)

if not exist ".venv\Scripts\python.exe" (
    echo Creation de l'environnement Python local...
    if not defined PYTHON_CMD (
        echo Python est introuvable. Installez Python 3 puis relancez ce fichier.
        pause
        exit /b 1
    )
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 (
        echo Creation de l'environnement Python impossible.
        pause
        exit /b 1
    )
)

echo Installation / mise a jour des dependances...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Installation des dependances impossible.
    pause
    exit /b 1
)

echo.
echo InstaLocalPlanner demarre sur http://127.0.0.1:5000
echo Fermez cette fenetre pour arreter le serveur.
echo.
start "" "http://127.0.0.1:5000"
".venv\Scripts\python.exe" app.py
pause
