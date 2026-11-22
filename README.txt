SUGGESTION BOX - setup (Vercel)

1. In your GitHub repo, delete the OLD upload files if they exist:
   api/upload.js, api/gallery.js, api/moderate.js   (the site no longer uses them)
2. Copy this pack into the repo root: api/suggest.js, api/suggestions.js, admin.html, package.json
   (if you already have a package.json with @vercel/blob, keep yours).
   Also replace index.html with the new one. Commit and push.
3. Vercel dashboard > your project > Storage > connect (or create) a Blob store. A PRIVATE store (the default) is fine, this pack is built for it.
4. Vercel > Settings > Environment Variables: add ADMIN_KEY = a long private password (12+ characters). Redeploy.
5. Read suggestions at https://YOUR-SITE/admin.html  (enter the ADMIN_KEY).
