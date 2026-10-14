# Vercel Deployment Fix for Wall Images

## Problem
Wall images (wall1.jpg - wall12.jpg) were not showing up after deployment to Vercel because they are stored in Git LFS (Large File Storage), and Vercel doesn't pull LFS files by default.

## Solution Applied

### 1. Created `.lfsconfig`
This file tells Git LFS which files to fetch specifically.

### 2. Updated `vercel.json`
Added `buildCommand` to pull LFS files before building:
```json
"buildCommand": "git lfs pull && npm run build"
```

### 3. Added CORS Headers
Configured proper headers for asset files to ensure they load correctly from any origin.

## Vercel Dashboard Configuration

If the buildCommand in vercel.json doesn't work, you need to configure Vercel manually:

1. Go to your project settings on Vercel Dashboard
2. Navigate to **Settings → Git → Git LFS**
3. Enable **"Enable Git LFS"**

OR

4. Go to **Settings → General → Build & Development Settings**
5. Override the build command with: `git lfs pull && npm run build`

## Alternative Solution (If LFS Still Doesn't Work)

If Vercel continues to have issues with LFS, you can untrack these images from LFS:

```bash
# Remove images from LFS
git lfs untrack "src/assets/wall*.jpg"

# Remove from .gitattributes
# (Edit .gitattributes to remove the *.jpg line)

# Convert LFS pointers to actual files
git lfs migrate export --include="src/assets/wall*.jpg"

# Commit the changes
git add .
git commit -m "Convert wall images from LFS to regular Git"
git push
```

## Testing

After deploying:
1. Open browser console (F12)
2. Select a wall tile from the "Wall tiles" category
3. Check console logs:
   - Should see: "Loading texture: [name] URL: [url]"
   - Should see: "✓ Loaded: [name]"
   - If error: "✗ Failed to load: [name]" with error details

## Files Modified

- `vercel.json` - Added buildCommand and CORS headers
- `.lfsconfig` - Configured LFS to fetch wall images
- `vite.config.ts` - Added assetsInlineLimit: 0 to ensure images are emitted as files
- `src/vite-env.d.ts` - Added image module declarations
- `src/App.tsx` - Added error handling and console logging for texture loading
