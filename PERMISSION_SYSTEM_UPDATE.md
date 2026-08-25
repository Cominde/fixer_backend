# Permission System Update

## Overview
This update implements a complete Role-Based Access Control (RBAC) system for workers, allowing the admin to manage permissions through roles and individual worker overrides.

## What's New

### 1. Worker Login System
- **New Field**: `generatedPassword` added to Worker model
- **Auto-Generation**: When adding a worker, a random password is automatically generated
- **Login Endpoint**: `POST /api/V1/auth/worker/login`
  - Requires: `phoneNumber` and `generatedPassword`
  - Returns: JWT token for authentication

### 2. Permission Registry with Endpoints
- **Location**: `utils/permissions/registry.js`
- **Structure**: Each permission now includes:
  - `label`: Human-readable description
  - `endpoints`: Array of API endpoints with:
    - `method`: HTTP method (GET, POST, PUT, DELETE)
    - `path`: API route path
    - `params`: Required parameters (if any)

**Example:**
```javascript
'workers.view': { 
  label: 'View all workers',
  endpoints: [
    { method: 'GET', path: '/api/V1/Worker' },
    { method: 'GET', path: '/api/V1/Worker/:id', params: ['id'] },
    { method: 'GET', path: '/api/V1/Worker/search/:searchString', params: ['searchString'] },
  ]
}
```

### 3. Permission Management Endpoints

#### Roles
- `GET /api/V1/permissions/roles` - Get all roles
- `POST /api/V1/permissions/roles` - Create a new role
- `PUT /api/V1/permissions/roles/:id/permissions` - Set role permissions

#### Worker Permissions
- `GET /api/V1/permissions/workers/:id/permissions` - Get worker permissions (role + overrides)
- `PUT /api/V1/permissions/workers/:id/permissions` - Update worker permission overrides

#### Current Worker Permissions
- `GET /api/V1/permissions/my-permissions` - Get current worker's effective permissions with endpoints

### 4. Protected Routes
All major routes are now protected with `checkPermission` middleware:
- **Workers**: `WorkersRoute.js` - All worker management routes
- **Cars**: `GarageRoute.js` - All car management routes
- **Repairs**: `repairingRoute.js` - All repair management routes
- **Measurements**: `measurementRoute.js` - All measurement routes
- **Inventory**: `inventoryRoute.js` - All inventory routes
- **Users**: `userRoute.js` - User management routes
- **Permissions**: `permissionRoute.js` - Permission management routes
- **Category Codes**: `CategoryCodeRoute.js` - Category code routes

## How to Apply Updates

### Step 1: Update Database Schema
The `Permission` model now includes an `endpoints` field. Run the seed script to update permissions:

```bash
node scripts/seedPermissions.js
```

This will:
- Clear existing permissions
- Seed 42 permissions with correct endpoints
- Store endpoints with method, path, and params information

### Step 2: Create Roles
Create roles for different worker types:

```bash
POST /api/V1/permissions/roles
{
  "name": "Technician",
  "isFullAccess": false,
  "description": "Can perform basic repair tasks"
}
```

### Step 3: Assign Permissions to Roles
```bash
PUT /api/V1/permissions/roles/{roleId}/permissions
{
  "permissions": ["repairs.view", "repairs.add", "repairs.edit", "repairs.services.manage"]
}
```

### Step 4: Assign Role to Workers
When adding or updating a worker, assign a role:

```bash
PUT /api/V1/Worker/withoutNID/{workerId}
{
  "roleId": "{roleId}"
}
```

### Step 5: (Optional) Set Worker Overrides
For specific workers, override role permissions:

```bash
PUT /api/V1/permissions/workers/{workerId}/permissions
{
  "permissions": {
    "repairs.delete": true,
    "workers.salary.view": false
  }
}
```

## Permission Key Reference

### Workers
- `workers.view` - View all workers
- `workers.add` - Add a new worker
- `workers.edit` - Edit worker details
- `workers.delete` - Delete a worker
- `workers.salary.view` - View worker salaries
- `workers.money.add` - Add loans/penalties/rewards to worker

### Cars
- `cars.view` - View all cars
- `cars.add` - Add a new car
- `cars.edit` - Edit car details
- `cars.delete` - Delete a car
- `cars.image.upload` - Upload car image
- `cars.image.generate` - Generate car image

### Repairs
- `repairs.view` - View all repairs
- `repairs.add` - Create a new repair
- `repairs.edit` - Edit repair details
- `repairs.delete` - Delete a repair
- `repairs.technicians.manage` - Manage technicians in repairs
- `repairs.components.manage` - Manage components in repairs
- `repairs.services.manage` - Manage services in repairs
- `repairs.search` - Search repairs

### Repair Type Filtering
The `GET /api/V1/repairing/getById/:id` endpoint supports filtering repairs by type via the request body:

**Request Body:**
```json
{
  "type": "periodic" | "nonPeriodic" | "all"
}
```

- `"periodic"` - Returns only periodic repairs
- `"nonPeriodic"` - Returns only non-periodic repairs
- `"all"` or omit - Returns all repairs (default behavior)

**Example:**
```javascript
POST /api/V1/repairing/getById/{carId}
{
  "type": "periodic"
}
```

### Measurements
- `measurements.view` - View all measurements
- `measurements.add` - Create a new measurement
- `measurements.edit` - Edit measurement details
- `measurements.delete` - Delete a measurement
- `measurements.accept` - Accept measurement (convert to repair)
- `measurements.walkin` - Create walk-in measurement

### Inventory
- `inventory.view` - View inventory
- `inventory.add` - Add inventory item
- `inventory.edit` - Edit inventory item
- `inventory.delete` - Delete inventory item

### Users
- `users.view` - View all users
- `users.edit` - Edit user details
- `users.delete` - Delete user

### Permissions
- `permissions.roles.view` - View roles
- `permissions.roles.create` - Create roles
- `permissions.roles.edit` - Edit role permissions
- `permissions.workers.permissions.view` - View worker permissions
- `permissions.workers.permissions.edit` - Edit worker permission overrides

### Category Codes
- `categoryCodes.view` - View category codes
- `categoryCodes.add` - Add category code
- `categoryCodes.edit` - Edit category code
- `categoryCodes.delete` - Delete category code

## Frontend Integration

### 1. Worker Login
```javascript
POST /api/V1/auth/worker/login
{
  "phoneNumber": "01012345678",
  "generatedPassword": "A1B2C3"
}
```

Response:
```json
{
  "message": "Login successful",
  "data": {
    "worker": { /* worker details */ }
  },
  "token": "jwt_token_here"
}
```

### 2. Get Worker Permissions
```javascript
GET /api/V1/permissions/my-permissions
Authorization: Bearer {token}
```

Response:
```json
{
  "workerId": "worker_id",
  "role": "Technician",
  "roleDefaults": {
    "repairs.view": true,
    "repairs.add": true
  },
  "overrides": {
    "repairs.delete": true
  },
  "effective": {
    "repairs.view": true,
    "repairs.add": true,
    "repairs.delete": true
  },
  "permissions": {
    "repairs.view": {
      "label": "View all repairs",
      "endpoints": [
        { "method": "GET", "path": "/api/V1/repairing", "params": [] },
        { "method": "GET", "path": "/api/V1/repairing/:id", "params": ["id"] }
      ]
    }
  }
}
```

### 3. Build UI Based on Permissions
Use the `effective` object to show/hide UI elements:
```javascript
if (permissions.effective['repairs.add']) {
  // Show "Add Repair" button
}

if (permissions.effective['repairs.delete']) {
  // Show "Delete" button
}
```

Use the `endpoints` array to make API calls:
```javascript
const endpoint = permissions.permissions['repairs.view'].endpoints[0];
fetch(endpoint.path, {
  method: endpoint.method,
  headers: { Authorization: `Bearer ${token}` }
});
```

## Important Notes

1. **Admin Access**: Admin users (role: "admin") have full access to all routes regardless of permissions
2. **Regular Users**: Regular users (not workers) are not affected by the permission system
3. **Worker Authentication**: Workers must use the worker login endpoint and JWT token
4. **Permission Inheritance**: Workers inherit permissions from their role, with individual overrides taking precedence
5. **Empty Endpoints**: Some permissions (like `repairs.technicians.manage`) have empty endpoints arrays as they are managed within other endpoints

## Files Modified

1. **Models**:
   - `models/Worker.js` - Added `generatedPassword` field
   - `models/Permission.js` - Added `endpoints` field

2. **Services**:
   - `services/WorksServices.js` - Auto-generate password when adding worker
   - `services/authService.js` - Added `workerLogin` function
   - `services/permissionService.js` - Added `getMyPermissions` function

3. **Routes**:
   - `routes/authRoute.js` - Added worker login route
   - `routes/permissionRoute.js` - Added permission management routes
   - `routes/WorkersRoute.js` - Added checkPermission middleware
   - `routes/GarageRoute.js` - Added checkPermission middleware
   - `routes/repairingRoute.js` - Added checkPermission middleware
   - `routes/measurementRoute.js` - Added checkPermission middleware
   - `routes/inventoryRoute.js` - Added checkPermission middleware
   - `routes/userRoute.js` - Added checkPermission middleware
   - `routes/CategoryCodeRoute.js` - Added checkPermission middleware

4. **Middlewares**:
   - `middlewares/checkPermission.js` - Combined authentication and authorization

5. **Utils**:
   - `utils/permissions/registry.js` - Added endpoints to permission registry

6. **Scripts**:
   - `scripts/seedPermissions.js` - Updated to handle new registry structure

## Agent Instructions

### JWT Authentication Requirement
**CRITICAL: All API endpoints must include JWT authentication.**

When making any API call to the system, always include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

This applies to ALL endpoints including:
- Car management (GET, POST, PUT, DELETE)
- Repair management (GET, POST, PUT, DELETE)
- Worker management (GET, POST, PUT, DELETE)
- Inventory management (GET, POST, PUT, DELETE)
- Measurement management (GET, POST, PUT, DELETE)
- User management (GET, POST, PUT, DELETE)
- Permission management (GET, POST, PUT, DELETE)
- Category code management (GET, POST, PUT, DELETE)

### Frontend Development Tasks

#### 1. Role and Permission Management Page
Create a page to manage roles and permissions with the following features:
- **List all roles** with their permissions
- **Create new roles** with name, description, and full access toggle
- **Edit role permissions** by selecting/deselecting permissions
- **Delete roles** (with confirmation)
- **View permission details** including endpoints

Required API calls:
- `GET /api/V1/permissions/roles` - Get all roles
- `POST /api/V1/permissions/roles` - Create new role
- `PUT /api/V1/permissions/roles/:id/permissions` - Set role permissions
- `DELETE /api/V1/permissions/roles/:id` - Delete role

#### 2. Walk-in Repairs Page
Create a page for walk-in repairs (repairs without generatedCode or carId) with the following features:
- **Create walk-in repairs** with:
  - Client name
  - Car number (optional)
  - Brand, category, model
  - Services and additions
  - Technicians assignment
  - Expected date
- **Update walk-in repairs** like normal repairs:
  - Add/remove services
  - Update service states
  - Add/remove additions
  - Manage technicians
  - Update completion status
- **View walk-in repairs** list with filtering
- **Convert walk-in to regular repair** when car is registered

Required API calls:
- `POST /api/V1/repairing` - Create walk-in repair (carId: null, generatedCode: null)
- `PUT /api/V1/repairing/:id` - Update walk-in repair
- `GET /api/V1/repairing` - Get all repairs (filter for walk-in)
- `PUT /api/V1/repairing/:id` - Convert to regular repair (add carId and generatedCode)

#### 3. Worker Login Page
Create a dedicated login page for workers with the following features:
- **Phone number input** for worker identification
- **Generated password input** for authentication
- **Login button** to authenticate
- **Error handling** for invalid credentials
- **JWT token storage** after successful login
- **Redirect to dashboard** after login
- **Logout functionality** with token clearing

Required API calls:
- `POST /api/V1/auth/worker/login` - Worker login
  - Body: `{ phoneNumber, generatedPassword }`
  - Response: `{ message, data: { worker }, token }`

After login, store the JWT token and include it in all subsequent API calls.

### Important Notes
1. **JWT Token Storage**: Store the JWT token securely (localStorage or secure cookie)
2. **Token Refresh**: Implement token refresh if needed (check JWT_EXPIRES_IN)
3. **Permission Checks**: Use the `/api/V1/permissions/my-permissions` endpoint to get worker permissions and conditionally show UI elements
4. **Error Handling**: Handle 401 Unauthorized responses by redirecting to login
5. **Walk-in Repair Identification**: Identify walk-in repairs by checking if `carId` is null and `generatedCode` is null/empty

## Troubleshooting

### Issue: Permission not working
- Ensure the seed script has been run: `node scripts/seedPermissions.js`
- Check that the worker has a role assigned
- Verify the role has the required permissions
- Check for individual worker overrides

### Issue: Worker login fails
- Ensure the worker has a `generatedPassword` field
- Use the correct phone number and generated password
- Check that the worker exists in the database

### Issue: Frontend can't access routes
- Ensure the worker is logged in with a valid JWT token
- Check that the token is included in the Authorization header
- Verify the worker has the required permissions

### Issue: Walk-in repairs not showing
- Check that the repair has `carId: null` and `generatedCode: null`
- Use the getRepairingCars endpoint which includes incomplete repairs without generatedCode
- Filter repairs by checking for missing generatedCode
