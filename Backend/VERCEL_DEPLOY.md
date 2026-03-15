# Deploying Backend to Vercel (fix CORS / 404)

If the frontend gets **CORS** or **404** when calling this backend on Vercel, check the following.

## 1. Root Directory (required)

In the **Vercel project** for this backend:

- **Settings → General → Root Directory** must be set to **`Backend`** (the folder that contains this file, `api/`, `vercel.json`, and `src/`).

If Root Directory is empty or points to the repo root, Vercel will not use `Backend/vercel.json` or `Backend/api/index.js`, so requests will not hit Express and you will get 404 with no CORS headers.

## 2. Build

- **Build Command:** `npm run build`  
  (so `dist/` is created and `api/index.js` can load the app.)

- **Output Directory:** leave default (not used for serverless).

## 3. Environment variables

Set at least:

- `MONGODB_URI`
- `JWT_SECRET`

Optional:

- `CLIENT_ORIGIN` = `https://your-frontend.vercel.app` (or comma-separated list).  
  The app already allows `osencontributorhub-frontend.vercel.app` and `osenhub.vercel.app` by default.

## 4. Redeploy

After changing Root Directory or env vars, trigger a **new deployment** (Redeploy) from the Vercel dashboard.
