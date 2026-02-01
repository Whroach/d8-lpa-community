# Railway Deployment Guide for D8-LPA Dating App

## Overview
This guide will help you deploy the complete dating app (frontend, backend, and database) to Railway.

## Prerequisites
- GitHub account (repo already uploaded ✅)
- Railway account (free at https://railway.app)
- MongoDB Atlas account (free at https://www.mongodb.com/cloud/atlas)

---

## Step 1: Set Up MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a new project (free tier)
3. Create a cluster
4. Add database user with username/password
5. Get the connection string: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
6. Save this for Step 2

---

## Step 2: Deploy Backend on Railway

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose `d8-lpa-community` repository
6. Configure:
   - **Service name**: `d8-lpa-backend`
   - **Root directory**: `server`
   - **Build command**: `npm install`
   - **Start command**: `npm start`

7. Go to "Variables" tab and add:
   ```
   MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/dating-app?retryWrites=true&w=majority
   JWT_SECRET = generate-a-random-string-here
   NODE_ENV = production
   PORT = 5001
   ALLOWED_ORIGINS = https://your-frontend.railway.app
   ```

8. Click "Deploy"
9. Go to "Settings" → "Public Networking" to get your public URL
   - Format: `https://d8-lpa-backend-prod.railway.app`
   - **Save this URL!**

---

## Step 3: Deploy Frontend on Railway

1. Click "New" in your project
2. Select "Deploy from GitHub repo"
3. Choose `d8-lpa-community` repository (same repo)
4. Configure:
   - **Service name**: `d8-lpa-frontend`
   - **Root directory**: `.` (root of repo)
   - **Build command**: `npm run build`
   - **Start command**: `npm start`

5. Go to "Variables" tab and add:
   ```
   NEXT_PUBLIC_API_URL = https://d8-lpa-backend-prod.railway.app/api
   NODE_ENV = production
   ```

6. Click "Deploy"
7. Go to "Settings" → "Public Networking" to get your public URL
   - Format: `https://d8-lpa-frontend-prod.railway.app`
   - **This is your live app!**

---

## Step 4: Update Backend CORS (Important!)

Update [server/src/index.js](../server/src/index.js) with your frontend URL:

In Railway Backend Variables, set:
```
ALLOWED_ORIGINS = https://d8-lpa-frontend-prod.railway.app,http://localhost:3000
```

(Already configured to read from environment variable ✅)

---

## Step 5: Test Everything

1. **Health Check**: Visit `https://d8-lpa-backend-prod.railway.app/api/health`
   - Should return: `{"status":"ok","timestamp":"..."}`

2. **Frontend**: Visit `https://d8-lpa-frontend-prod.railway.app`
   - Try signing up with test account
   - Try logging in

3. **Database**: Data should appear in MongoDB Atlas

---

## Monitoring & Logs

### View Backend Logs
1. Railway dashboard → Select backend service
2. Go to "Deployments" tab
3. Click on latest deployment
4. View real-time logs

### View Frontend Logs
1. Railway dashboard → Select frontend service
2. Go to "Deployments" tab
3. View build and runtime logs

---

## Environment Variables Summary

### Backend (server) - Set in Railway
| Variable | Value | Example |
|----------|-------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Random secret for JWT signing | `your-secret-key` |
| `NODE_ENV` | `production` | `production` |
| `PORT` | 5001 | `5001` |
| `ALLOWED_ORIGINS` | Frontend URL (comma-separated) | `https://your-frontend.railway.app` |

### Frontend - Set in Railway
| Variable | Value | Example |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Backend URL + /api | `https://your-backend.railway.app/api` |
| `NODE_ENV` | `production` | `production` |

---

## Troubleshooting

### "Permission denied" on backend deploy
- Check MongoDB Atlas connection string is correct
- Verify JWT_SECRET is set
- Check ALLOWED_ORIGINS matches your frontend URL

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL` in frontend variables
- Check backend is running: visit health endpoint
- Verify CORS is configured correctly in backend

### Database connection failing
- Test MongoDB Atlas connection string locally
- Check IP whitelist in MongoDB Atlas (should be 0.0.0.0/0 for Railway)
- Verify username/password are correct

### Builds failing
- Check Railway deployment logs
- Ensure `package.json` has correct build/start scripts
- Verify root directories are set correctly

---

## Next Steps

1. **Custom Domain** (Optional):
   - In Railway → Settings → Domains
   - Add your custom domain (costs extra)

2. **Email Notifications** (Optional):
   - Set `EMAIL_USER` and `EMAIL_PASS` in backend variables
   - Uses Gmail SMTP for password resets

3. **Image Uploads** (Optional):
   - Set AWS S3 variables in backend
   - Configure S3 bucket for media uploads

4. **Monitoring & Alerts**:
   - Set up error notifications
   - Monitor database usage

---

## Cost

| Service | Free Tier | Monthly Cost |
|---------|-----------|--------------|
| Railway Backend | Yes | $5-10 after free credits |
| Railway Frontend | Yes | Included |
| MongoDB Atlas | 512MB | Free (enough for development) |
| **Total** | **Free for development** | **~$5-10/month** |

---

## Support

- Railway Docs: https://docs.railway.app
- MongoDB Docs: https://docs.mongodb.com
- Next.js Docs: https://nextjs.org/docs
- Express Docs: https://expressjs.com

