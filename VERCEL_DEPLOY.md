# Vercel Deployment Fix for Wall Images

## Problem
Wall images (wall1.jpg - wall12.jpg) are stored in Git LFS and Vercel doesn't automatically pull LFS files during deployment.

## ✅ IMMEDIATE FIX - Do This in Vercel Dashboard

### Step 1: Go to Vercel Project Settings
1. Open your project on Vercel
2. Go to **Settings** tab
3. Navigate to **Git** section

### Step 2: Enable Git LFS
Look for **"Git LFS"** setting and **enable** it.

If you don't see this option, continue to Step 3.

### Step 3: Override Build Command
1. Go to **Settings → General**
2. Scroll to **Build & Development Settings**
3. **Override** the Build Command with:
   ```
   bash build.sh
   ```
4. Click **Save**

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click the **three dots menu** (•••)
4. Select **Redeploy**

## Files in This Repo

### `build.sh`
Custom build script that:
1. Installs Git LFS
2. Pulls LFS files (including wall images)
3. Runs the normal build

### `vercel.json`
Configured to:
- Use the custom build script
- Add CORS headers for assets
- Set proper cache control

### `.lfsconfig`
Tells Git LFS which files to fetch.

## Alternative: Remove LFS (If All Else Fails)

If Vercel continues to have issues with LFS:

```bash
# Untrack images from LFS
git lfs untrack "src/assets/wall*.jpg"

# Update .gitattributes to remove *.jpg line
# Edit .gitattributes and remove or comment out: *.jpg filter=lfs...

# Convert LFS pointers to actual files
git lfs migrate export --include="src/assets/wall*.jpg" --everything

# Commit the changes
git add .gitattributes src/assets/
git commit -m "Remove wall images from LFS"
git push --force
```

## Testing

After deployment:
1. Open your deployed site
2. Press F12 to open browser console
3. Click "Wall tiles" category
4. Select any wall tile
5. Check console for:
   - ✓ "Loading texture: [name] URL: [url]"
   - ✓ "✓ Loaded: [name]"
6. The wall texture should appear on the 3D model

## Troubleshooting

### Still not working?
1. Check Vercel build logs for LFS errors
2. Verify build.sh was executed (should see "Installing Git LFS..." in logs)
3. Try the "Remove LFS" alternative above

### Can't find Git LFS setting in Vercel?
Some Vercel plans don't show this setting. Use the "Override Build Command" method instead.
