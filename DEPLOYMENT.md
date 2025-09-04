# 🚀 Super Simple Deployment Guide

This guide will get you from "code on your machine" to "live on the internet" in about 5 minutes.

## 📋 Prerequisites

- ✅ Code pushed to GitHub
- ✅ Cloudflare account (free tier is fine)
- ✅ Wrangler CLI installed (`npm install -g wrangler` if you don't have it)

## 🎯 Step-by-Step Setup

### Step 1: Connect Frontend to Cloudflare Pages (2 minutes)

1. **Go to Cloudflare Dashboard**

   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Click **"Pages"** in the sidebar

2. **Connect Your Repository**

   - Click **"Connect to Git"**
   - Choose **"GitHub"**
   - Select your `super-tic-tac-toe` repository
   - Click **"Begin setup"**

3. **Configure Build Settings**

   ```
   Project name: super-tic-tac-toe (or whatever you like)
   Production branch: main
   Build command: npm run build
   Build output directory: dist
   Root directory: / (leave blank)
   ```

4. **Deploy!**
   - Click **"Save and Deploy"**
   - Wait ~2 minutes for first build
   - Your frontend is now live! 🎉

### Step 2: Deploy Worker Backend (1 minute)

1. **Login to Wrangler**

   ```bash
   cd worker
   npx wrangler login
   ```

   - This opens a browser to authenticate

2. **Deploy Worker**
   ```bash
   npm run deploy
   ```
   - Your worker is now live! 🎉

### Step 3: Update Frontend URL (30 seconds)

Your worker will be deployed to a URL like:
`https://super-tic-tac-toe-worker.YOUR_SUBDOMAIN.workers.dev`

1. **Update the worker URL in your frontend**

   ```typescript
   // In src/lib/websocket.ts, update the baseUrl:
   constructor(
     baseUrl: string = "https://super-tic-tac-toe-worker.YOUR_SUBDOMAIN.workers.dev"
   ) {
   ```

2. **Push the change**
   ```bash
   git add .
   git commit -m "update worker URL"
   git push
   ```
   - Frontend auto-deploys with the new URL! ✨

## 🎉 You're Done!

**Frontend**: Auto-deploys on every `git push`
**Worker**: Deploy with `npm run deploy:worker` when you change backend

## 🔧 Daily Workflow

**Making frontend changes:**

```bash
# Make your changes
git add .
git commit -m "awesome new feature"
git push
# ✨ Auto-deploys to Cloudflare Pages
```

**Making worker changes:**

```bash
# Make your changes
npm run deploy:worker
# ✨ Worker updated instantly
```

**Making both changes:**

```bash
# Make your changes
git add .
git commit -m "full-stack update"
git push                    # Frontend auto-deploys
npm run deploy:worker      # Worker deploys manually
```

## 🐛 Troubleshooting

**Frontend not building?**

- Check the build logs in Cloudflare Pages dashboard
- Make sure `npm run build` works locally

**Worker not deploying?**

- Run `npx wrangler whoami` to check if you're logged in
- Make sure you're in the `worker/` directory

**CORS errors?**

- Check that your worker URL is correctly set in the frontend
- Verify the `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` includes your Pages URL

## 🌟 Pro Tips

- **Preview deployments**: Every branch push creates a preview URL
- **Rollbacks**: Use Cloudflare Pages dashboard to rollback bad deployments
- **Logs**: Check worker logs with `npx wrangler tail`
- **Local testing**: Use `npm run dev` (frontend) and `cd worker && npm run dev` (worker)

**That's it! You now have a professional deployment setup with minimal complexity.**
