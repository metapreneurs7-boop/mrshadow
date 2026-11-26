MRSHADOW site backend (Vercel) - suggestion box + AI chat

FILES
  api/chat.js         AI chat (keeps your OpenRouter key secret on the server)  <-- NEW
  api/suggest.js      receives visitor suggestions
  api/suggestions.js  lists/deletes suggestions for admin.html
  admin.html          your private page to read suggestions
  package.json

SETUP
1. Copy these files into the root of your GitHub repo (api folder stays at the top level) along with the new index.html. Commit.
2. Vercel > your project > Settings > Environment Variables, add:
     OPENROUTER_API_KEY = a NEW key from openrouter.ai/settings/keys   (set a spend limit on it)
     ADMIN_KEY          = your private admin password
   (BLOB_READ_WRITE_TOKEN is added automatically when the Blob store is connected.)
3. Deployments > Redeploy.
4. NEVER put the OpenRouter key inside index.html again.

OPTIONAL: AI_MODEL environment variable to change the model (default openai/gpt-4o-mini, it must accept images).
