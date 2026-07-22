# Replace the existing Betynz GitHub repository safely

## Recommended: archive first, then replace the contents

1. In GitHub, open the current Betynz repository.
2. Open **Settings → General → Danger Zone**.
3. Choose **Archive this repository** only if you want a permanent read-only backup.
4. For a replace-in-place launch, download a ZIP backup instead and keep the repository active.
5. On your computer, rename the old project folder to `betynz-old-backup-YYYY-MM-DD`.
6. Extract this package into a new folder named `betynz`.
7. Open the new folder in VS Code.
8. Open the terminal and run:

```bash
npm install
npm run dev
```

## Replace the existing repository while keeping its URL

Run inside the new `betynz` folder:

```bash
git init
git branch -M main
git add .
git commit -m "Fresh Betynz rebuild: UI and Chronos API"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push --force origin main
```

`--force` replaces the current branch history. Keep the downloaded backup before doing this.

## Safer alternative: create a new repository

Create `betynz-v2`, push this code there, deploy and test it, then change the Betynz domain only after everything works. This avoids downtime and makes rollback easy.
