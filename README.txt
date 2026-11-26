MRSHADOW site backend (Vercel): suggestion box + AI chat + saved chats with Google sign-in

FILES (keep the folders exactly like this in your GitHub repo root)
  index.html
  admin.html
  package.json
  api/chat.js          AI chat (OpenRouter key stays on the server)
  api/suggest.js       visitor suggestions
  api/suggestions.js   admin list of suggestions
  api/auth.js          NEW: verifies "Sign in with Google"
  api/sync.js          NEW: saves/loads each person's chats and projects (private Blob)
  lib/session.js       NEW: signed session tokens

VERCEL ENVIRONMENT VARIABLES
  OPENROUTER_API_KEY   your OpenRouter key
  ADMIN_KEY            password for /admin.html
  GOOGLE_CLIENT_ID     NEW: from Google Cloud (OAuth Client ID, ends with .apps.googleusercontent.com)
  SESSION_SECRET       NEW: any long random text, 32+ characters (make one up; keep it private)
  BLOB_READ_WRITE_TOKEN  (added automatically by the Blob store)

ALSO: in index.html set   const GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
(this one is public by design, it is safe in the page)

Saved chats and projects work on the same device even without Google sign-in.
Sign-in is only needed to open them on other devices.
