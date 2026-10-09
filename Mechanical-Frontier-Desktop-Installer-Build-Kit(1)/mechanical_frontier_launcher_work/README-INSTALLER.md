# Mechanical Frontier — Windows desktop installer

This project packages the Next.js/Three.js game as a standalone Electron desktop application. The player installs `Mechanical-Frontier-Setup-1.0.0.exe`, launches Mechanical Frontier from the Start menu or desktop shortcut, and gets a dedicated game window. The installed app includes the Electron/Node runtime it needs; players do **not** need to install Node.js, PostgreSQL, or a separate browser.

## Build the installer

The final Windows installer must be built on a machine with internet access because npm must download the project's packages, Electron, and the Windows installer tooling. The build computer needs Node.js 22 (or a compatible newer Node release); the player computer does not.

On Windows, from this project folder, run:

```powershell
.\Build-Windows-Installer.ps1
```

When successful, the installer will be at:

```text
dist-installer\Mechanical-Frontier-Setup-1.0.0.exe
```

Then copy that single `.exe` to the target Windows computer and run it. The installer creates Start-menu and desktop shortcuts. World saves are kept in the current Windows user's application-data folder and are not erased by uninstalling the game.

## Build with GitHub Actions instead

Push this project to a GitHub repository and run **Actions → Build Windows installer → Run workflow**, or push to `main`/`master`. Download the resulting `Mechanical-Frontier-Windows-Installer` artifact from the completed workflow. GitHub's build runner installs Node for compiling; the installed game still does not require Node on the player's computer.

## Important status note

The source project has a desktop packaging configuration, but the final `.exe` must be emitted by a successful Windows build. The current restricted build environment could not access the npm registry, so it could not download Electron or compile that `.exe` here.
