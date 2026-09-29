@echo off
rem Lance Cap 82-0 sans passer par l'executable compile : utile pendant le
rem developpement, et suffisant pour jouer. La fenetre de console se ferme
rem toute seule, le jeu reste ouvert.
cd /d "%~dp0desktop"
start "" /b cmd /c "npx electron . >nul 2>&1"
exit
