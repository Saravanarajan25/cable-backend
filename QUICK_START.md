# 🚀 CABLE BILL MANAGER - QUICK START GUIDE

## ⚡ Quick Start (Windows)

### Option 1: Using Batch Scripts (Easiest)

1. **Start Backend**:
   - Double-click `START_BACKEND.bat` in `backnd\` folder
   - Wait for "Ready to accept requests" message

2. **Start Frontend** (in a new window):
   - Double-click `START_FRONTEND.bat` in `frontrd\` folder
   - Browser will open automatically at http://localhost:8080

### Option 2: Using Command Line

**Backend:**
```bash
cd backnd
npm install  # Only needed first time
npm start
```

**Frontend** (new terminal):
```bash
cd frontrd
npm install  # Only needed first time
npm run dev
```

---

## 🔐 Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

---

## ✅ Verification Checklist

After starting both servers, verify:

### 1. Backend Health
- Open: http://localhost:3001
- Should see: `{"status":"OK","message":"CablePay Backend Server is running"}`

### 2. API Health
- Open: http://localhost:3001/api
- Should see: List of available endpoints

### 3. Frontend
- Open: http://localhost:8080
- Should see: Login page
- Login with admin/admin123
- Should redirect to Dashboard

### 4. Browser Console (F12)
Check for these logs:
```
[API Client] Environment VITE_API_URL: http://localhost:3001/api
[API Client] Using API URL: http://localhost:3001/api
[API Client] Initialized with baseURL: http://localhost:3001/api
```

If you see these logs, environment is loaded correctly!

---

## 🔧 Troubleshooting

### Issue: "Failed to fetch payments"

**Check:**
1. Is backend running? (http://localhost:3001 should work)
2. Open browser console (F12) → Check for error messages
3. Look for `[API]` logs showing the exact error

**Common Causes:**
- Backend not started
- Backend crashed (check backend terminal for errors)
- Wrong port (backend must be on 3001, frontend on 8080)

### Issue: "Cannot connect to server"

**Solution:**
1. Stop frontend (Ctrl+C)
2. Stop backend (Ctrl+C)
3. Start backend first
4. Wait for "Ready to accept requests"
5. Then start frontend

### Issue: Login fails

**Check:**
1. Backend console for errors
2. Browser console for network errors
3. Verify `/api/login` endpoint works

### Issue: Environment variables not loading

**Check:**
1. `.env` file exists in both folders
2. No extra spaces or quotes in .env values
3. Restart both servers after changing .env

---

## 🎯 Testing All Features

1. **Login** → Use admin/admin123
2. **Dashboard** → Should show stats
3. **Add Home** → Fill form, submit
4. **Search Home** → Enter ID, search
5. **Reports** → Select month/year
6. **Mark Paid/Unpaid** → Toggle status
7. **Excel Export** → Download report

All features should work without errors!
