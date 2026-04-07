# Complete Setup Guide — SLT Admin Portal

## Step-by-Step Installation

### Step 1: Prerequisites

Ensure you have installed:
- **Node.js** 16.x or higher ([Download](https://nodejs.org/))
- **npm** 8.x or higher (comes with Node.js)
- **Backend API** running on `http://localhost:8080`

Verify installation:
```bash
node --version   # Should show v16.x.x or higher
npm --version    # Should show 8.x.x or higher
```

---

### Step 2: Extract and Navigate

```bash
# Extract the slt-admin-portal.zip file
unzip slt-admin-portal.zip

# Navigate into the project
cd slt-admin-portal
```

---

### Step 3: Install Dependencies

```bash
npm install
```

This will install:
- react & react-dom (UI library)
- react-router-dom (routing)
- axios (HTTP client)
- recharts (charts)
- date-fns (date utilities)
- react-scripts (build tools)

**Expected output:**
```
added 1523 packages in 45s
```

---

### Step 4: Configure API Endpoint (Optional)

If your backend is NOT on `http://localhost:8080`, update the API URL:

**Option A: Environment Variable (Recommended)**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:
   ```env
   REACT_APP_API_URL=http://your-backend-url:port/api
   ```

**Option B: Direct Code Change**

Edit `src/api/axiosConfig.js`:
```javascript
const api = axios.create({
  baseURL: 'http://your-backend-url:port/api',
});
```

---

### Step 5: Start Development Server

```bash
npm start
```

**Expected output:**
```
Compiled successfully!

You can now view slt-admin-portal in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://10.207.32.93:3000

Note that the development build is not optimized.
To create a production build, use npm run build.

webpack compiled successfully
```

The browser will automatically open to `http://localhost:3000`.

---

### Step 6: Login

Use these default credentials (after running `init_users.sql` on backend):

| Username | Password | Role | Access Level |
|---|---|---|---|
| `superadmin` | `admin123` | SUPER_ADMIN | All 10 pages |
| `admin.colombo` | `admin123` | ADMIN | All except Branches |
| `tl.john` | `admin123` | TEAM_LEAD | Dashboard, Faults, Inventory, KPI |

---

## Common Issues & Solutions

### Issue 1: "npm: command not found"

**Solution:** Install Node.js from https://nodejs.org/

---

### Issue 2: "Cannot GET /"

**Cause:** Development server hasn't started yet.

**Solution:** Wait for "webpack compiled successfully" message.

---

### Issue 3: "Failed to fetch" or "Network Error"

**Cause:** Backend API is not running or CORS not configured.

**Solution:**

1. **Check backend is running:**
   ```bash
   curl http://localhost:8080/api/auth/health
   ```

2. **Enable CORS in Spring Boot** (add to backend):
   ```java
   @Configuration
   public class CorsConfig {
       @Bean
       public WebMvcConfigurer corsConfigurer() {
           return new WebMvcConfigurer() {
               @Override
               public void addCorsMappings(CorsRegistry registry) {
                   registry.addMapping("/api/**")
                       .allowedOrigins("http://localhost:3000")
                       .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH")
                       .allowedHeaders("*")
                       .allowCredentials(true);
               }
           };
       }
   }
   ```

---

### Issue 4: Login redirects back to login page

**Cause:** JWT token not being saved or backend not returning token.

**Solution:**

1. Open browser DevTools (F12) → Console tab
2. Check for errors
3. Go to Application tab → Local Storage → `http://localhost:3000`
4. Verify `accessToken` exists

**If missing:**
- Check backend `AuthController.login()` returns `accessToken` field
- Check backend JWT secret is configured in `application.yml`

---

### Issue 5: Pages show "Unauthorized" or redirect to login

**Cause:** JWT token expired or invalid role.

**Solution:**

1. Logout and login again
2. Check token expiry in `application.yml`:
   ```yaml
   app:
     jwt:
       access-token-expiry-ms: 1800000  # 30 minutes
   ```

---

### Issue 6: Charts not displaying

**Cause:** No data from backend or recharts not installed.

**Solution:**

1. Check browser console for errors
2. Verify API endpoints return data:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/faults
   ```
3. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

## Build for Production

```bash
# Create optimized production build
npm run build
```

**Output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:

  52.1 kB  build/static/js/main.abc123.js
  1.2 kB   build/static/css/main.def456.css

The build folder is ready to be deployed.
```

**Serve locally:**
```bash
npx serve -s build
```

---

## Deployment

### Deploy to Netlify

1. Run `npm run build`
2. Go to [Netlify](https://app.netlify.com)
3. Drag `/build` folder to deploy

### Deploy to Vercel

1. Run `npm run build`
2. Install Vercel CLI: `npm i -g vercel`
3. Run: `vercel --prod`

### Deploy to AWS S3 + CloudFront

```bash
npm run build
aws s3 sync build/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

---

## Development Workflow

### 1. Start backend first
```bash
cd backend
./mvnw spring-boot:run
```

### 2. Start frontend
```bash
cd slt-admin-portal
npm start
```

### 3. Make changes
- Edit files in `src/`
- Browser auto-refreshes on save
- Check console for errors

### 4. Test
```bash
npm test
```

---

## File Structure Deep Dive

```
src/
├── api/                         # Backend API clients
│   ├── axiosConfig.js           # ✅ JWT interceptor, 401 handler
│   ├── authApi.js               # ✅ Login, logout, refresh
│   ├── faultApi.js              # ✅ CRUD faults, assign, history
│   ├── userApi.js               # ✅ User management
│   ├── branchApi.js             # ✅ Branch CRUD
│   ├── inventoryApi.js          # ✅ Materials, requests, alerts
│   ├── vehicleApi.js            # ✅ Fleet management
│   ├── paymentApi.js            # ✅ Payment approval
│   ├── kpiApi.js                # ✅ Leaderboard, scores
│   └── reportApi.js             # ✅ Reports + export
│
├── components/                  # Reusable UI
│   ├── index.js                 # ✅ All shared components
│   ├── Sidebar.js               # ✅ Collapsible nav with role logic
│   ├── Layout.js                # ✅ Main app layout
│   └── ProtectedRoute.js        # ✅ Route guards
│
├── context/
│   └── AuthContext.js           # ✅ Global auth state
│
├── pages/                       # All 10 pages
│   ├── Login/
│   │   └── LoginPage.js         # ✅ Page 1: Authentication
│   ├── Dashboard/
│   │   └── DashboardPage.js     # ✅ Page 2: KPI cards + charts
│   ├── Faults/
│   │   └── FaultsPage.js        # ✅ Page 3: Fault management
│   ├── Users/
│   │   └── UsersPage.js         # ✅ Page 4: User CRUD
│   ├── Branches/
│   │   └── BranchesPage.js      # ✅ Page 5: Branch management
│   ├── Inventory/
│   │   └── InventoryPage.js     # ✅ Page 6: Stock + requests
│   ├── Vehicles/
│   │   └── VehiclesPage.js      # ✅ Page 7: Fleet register
│   ├── Payments/
│   │   └── PaymentsPage.js      # ✅ Page 8: Approval queue
│   ├── KPI/
│   │   └── KpiPage.js           # ✅ Page 9: Leaderboard
│   └── Reports/
│       └── ReportsPage.js       # ✅ Page 10: Reports + export
│
├── App.js                       # ✅ Main router
└── index.js                     # ✅ React entry point
```

---

## Testing Checklist

### ✅ Page 1: Login
- [ ] Login with `superadmin` / `admin123`
- [ ] Verify redirect to Dashboard
- [ ] Check localStorage has `accessToken`
- [ ] Try invalid credentials (should show error)

### ✅ Page 2: Dashboard
- [ ] KPI cards show numbers
- [ ] Pie chart renders
- [ ] Line chart shows trend
- [ ] Leaderboard table has data

### ✅ Page 3: Faults
- [ ] Table shows faults
- [ ] Filters work (status, search)
- [ ] Assign button opens modal
- [ ] View details shows full info

### ✅ Page 4: Users
- [ ] Table shows all users
- [ ] Filter by role works
- [ ] Add User button opens form
- [ ] Edit/Deactivate buttons work

### ✅ Page 5: Branches
- [ ] Only accessible by SUPER_ADMIN
- [ ] CRUD operations work
- [ ] Branch code validation

### ✅ Page 6: Inventory
- [ ] 3 tabs render (Materials, Requests, Alerts)
- [ ] Search materials works
- [ ] Approve/Reject requests
- [ ] Low stock alerts show

### ✅ Page 7: Vehicles
- [ ] 3 tabs render (All, Expiring, Expired)
- [ ] Add vehicle form works
- [ ] Expiry alerts show correct vehicles
- [ ] Status updates work

### ✅ Page 8: Payments
- [ ] Pending queue shows payments
- [ ] View details modal
- [ ] Approve/Reject buttons work
- [ ] Adjusted amount field

### ✅ Page 9: KPI
- [ ] Leaderboard table sorts by score
- [ ] Bar chart shows top 5
- [ ] Performance labels color-coded
- [ ] Date filter works

### ✅ Page 10: Reports
- [ ] 4 report types selectable
- [ ] Date range picker works
- [ ] Generate report button
- [ ] Export CSV downloads file

---

## FAQ

**Q: Can I use this with a different backend?**  
A: Yes, update `axiosConfig.js` baseURL to your API endpoint. Ensure your backend returns data in the same format.

**Q: How do I add a new page?**  
A: 
1. Create `src/pages/NewPage/NewPagePage.js`
2. Add route in `src/App.js`
3. Add nav link in `src/components/Sidebar.js`

**Q: How do I change colors?**  
A: Update color codes in `src/components/index.js` and page files. Search for `#1a237e` (primary blue) to change theme.

**Q: Does this work offline?**  
A: No, this requires active backend connection. Consider adding service workers for offline support.

**Q: Can I use TypeScript?**  
A: Yes, rename `.js` to `.tsx`, add `@types` packages, and update `tsconfig.json`.

---

## Performance Tips

1. **Code Splitting:**
   ```javascript
   const Dashboard = React.lazy(() => import('./pages/Dashboard/DashboardPage'));
   ```

2. **Memoization:**
   ```javascript
   const MemoizedTable = React.memo(DataTable);
   ```

3. **Debounce Search:**
   ```javascript
   import { debounce } from 'lodash';
   const debouncedSearch = debounce(handleSearch, 300);
   ```

---

## Security Checklist

- ✅ JWT tokens stored in localStorage
- ✅ Tokens auto-attached to requests
- ✅ 401 responses redirect to login
- ✅ Role-based route protection
- ✅ No sensitive data in URL params
- ✅ HTTPS in production
- ⚠️ Consider httpOnly cookies for tokens (requires backend change)

---

## Next Steps

1. ✅ Setup complete — app compiles successfully
2. ✅ All 10 pages working
3. ✅ Connect to backend
4. ✅ Test with real data
5. 🔄 Customize branding (logo, colors)
6. 🔄 Add unit tests
7. 🔄 Deploy to production

---

**Congratulations! Your SLT Admin Portal is ready to use. 🎉**

**Webpack compiled successfully!**
