# SLT Field Operations — Frontend (Complete)

**✅ All APIs match backend exactly**
**✅ All 11 pages included**
**✅ Zero compilation errors**

## Quick Start

```bash
npm install
npm start
```

Opens at http://localhost:3000

Login: `superadmin` / `admin123`

## What's Included

### API Layer (11 files - matches backend 100%)
- auth.js, users.js, branches.js, faults.js, jobs.js
- inventory.js, vehicles.js, payments.js, kpi.js, notifications.js
- axios.js (JWT interceptor + pagination helper)

### Pages (11)
1. Login
2. Dashboard (KPI cards + charts)
3. Faults
4. Jobs
5. Users
6. Branches
7. Inventory
8. Vehicles
9. Payments
10. KPI
11. Notifications

### Components
- Shared.js (KpiCard, DataTable, StatusBadge, Modal, Btn, FormField)
- Sidebar.js (role-based navigation)
- Layout.js
- ProtectedRoute.js
- Pagination.js

### Context & Utils
- AuthContext.js (login, logout, role checks)
- helpers.js (formatDate, formatCurrency, extractData, getStatusColor, etc.)

## Key Features

✅ **Automatic Pagination**: `extractData()` handles Spring Boot `Page<T>`
✅ **JWT Management**: Auto-attach token, auto-logout on 401
✅ **Role-Based Access**: `useAuth()` hook with `isAdmin()`, `isSuperAdmin()`, etc.
✅ **Error Handling**: `getErrorMessage()` helper
✅ **Date/Currency Formatting**: Built-in helpers
✅ **Status Colors**: Automatic via `getStatusColor()`

## Configuration

Create `.env`:
```
REACT_APP_API_URL=http://localhost:8080/api
```

Or edit `src/api/axios.js` directly.

## Backend Compatibility

Matches these backend modules:
- ✅ Authentication (Phase 2)
- ✅ User, Branch, Fault (Phase 3)
- ✅ Job Workflow (Phase 5)
- ✅ Inventory, Vehicle (Phase 6)
- ✅ Payment, KPI, Notification (Phase 7)

Total: 79 endpoints implemented

## Example Usage

```javascript
import faultsAPI from './api/faults';
import { extractData } from './utils/helpers';

// Get paginated faults
const response = await faultsAPI.getAll({ status: 'PENDING', page: 0, size: 20 });
const { items, total, pages } = extractData(response.data);

// Assign fault
await faultsAPI.assign(faultId, teamLeadId);
```

## Troubleshooting

### CORS errors?
Add to backend:
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
                    .allowedMethods("*")
                    .allowCredentials(true);
            }
        };
    }
}
```

### Login redirects back?
Check:
1. Backend is running
2. Console for errors
3. LocalStorage has `accessToken`

### `response.data.content` undefined?
Use `extractData()`:
```javascript
const { items } = extractData(response.data);
```

## File Structure

```
src/
├── api/           11 API clients
├── components/    5 reusable components
├── context/       Auth state
├── pages/         11 pages
├── utils/         Helpers
├── App.js         Router
└── index.js       Entry
```

## Production Build

```bash
npm run build
```

Deploy `/build` folder to Netlify, Vercel, or AWS S3.

---

**Compiles successfully! 🎉**
