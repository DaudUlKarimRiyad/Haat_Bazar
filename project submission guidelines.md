
## **1\. What you must build**

Extend your own mid project (React with TypeScript, FastAPI, deployed on Vercel) into a secure multi-user application. The main work is JWT authentication, role based access control (RBAC) and an admin dashboard. Your domain stays your own, but the security and admin features must follow this document.

* Users sign up, log in, update their profile and change their password.  
* Every user has a role (user or admin). Normal users only see and change their own data. Admins manage users and content through an admin dashboard.  
* Your main resource can be shared in groups or teams where each member has different permissions (for example create, edit, assign). Only the owner can delete, rename or manage members.  
* Everything works on the deployed Vercel URLs, with demo accounts for the instructor.

## **2\. Expected features**

### **2.1 Authentication and JWT**

* Signup and login. Passwords are hashed with argon2 or bcrypt, never stored in plain text. A server-side secret (pepper) comes from an environment variable.  
* Access token is a signed JWT with a short lifetime (15 minutes or less) that contains the user id and role. It is verified on every protected request. Missing, invalid, tampered or expired tokens return 401\.  
* Refresh and logout: an httpOnly refresh cookie (or a hashed server-side refresh token), rotation or revocation, and a logout that really invalidates the session. Users can list and revoke their sessions.  
* Frontend session handling: refresh or log out when the server rejects the token, and no flash of guest content while the session restores.  
* Profile update and password change (current password required, new password validated, failed attempts recorded).

### **2.2 RBAC and authorization**

* Roles (user, admin) stored in the database and enforced on the server for every endpoint. Hiding a button in the UI is not security.  
* One reusable RBAC module (permission constants and a dependency or decorator), not scattered role checks.  
* Ownership rules: a user can only read, change or delete their own records. Other users' records return 403 or 404\.  
* Fine-grained permissions inside a shared resource (group, team or project membership): members have different permissions (create, update, assign), and only the owner can delete, rename or manage members.  
* Safety rules: an admin cannot change their own role or ban another admin. A banned user is rejected on the very next request.  
* Frontend route guards and role-based menus that match the server rules.

### **2.3 Admin dashboard**

* Overview statistics (users, banned users, records, groups, new in the last 7 days).  
* Users: list with search, filters (role, status) and pagination, and a detail view with the user's records, groups, sessions and recent activity.  
* User actions: ban and unban with a reason, role change, revoke sessions, bulk ban and unban.  
* Content moderation: list all records and groups with filters, delete one or many.  
* Activity (audit) log: login, failed login, logout, password change, role change, ban, delete and export events with user, IP address, browser and time, with filters and search.  
* Security view (failed logins by IP and by account) and CSV exports of users, records and activity that respect the filters.

### **2.4 Backend quality and security**

* Input validation, consistent error responses, no stack traces to the client, no secrets in the repository (only .env.example), CORS limited to your frontend.  
* Brute-force protection (lockout or rate limit) and automated tests (pytest) for login, token rejection and at least three RBAC rules. (Optional)

### 

### **2.5 Live deployment on Vercel**

The instructor tests only what is live. Localhost screenshots do not count.

* The frontend is live on Vercel, loads without errors, and page reloads and deep links work.  
* The FastAPI backend is live on Vercel with its API docs page, the frontend calls it (no localhost URLs, CORS set for the deployed frontend).  
* Every feature above works on the deployed URLs: login and token refresh, RBAC rules, groups with permissions, and the admin dashboard.  
* Data persists: use a hosted database, not a SQLite file in /tmp that is lost on a restart. Environment variables are set on Vercel.  
* The README lists the test account user IDs and roles for the instructor (at least 2 admins and 3 normal users, sample data, and one shared group with mixed permissions). Passwords go only in the submission form and the PDF report, never in the README.  
* The interface is usable: responsive layout, loading, error and empty states, no console errors on the main pages.

