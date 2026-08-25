<img src="https://skillicons.dev/icons?i=nodejs,js" />
<br>

# Fixer Backend
The backend service for Fixer, a car repair management system with JWT authentication and role-based permissions.

## Table of Contents
1. Overview
2. Features
3. Installation
4. Environment Variables
5. Usage
6. API Endpoints
7. Authentication
8. Contributing
9. License

## Overview
Fixer Backend is built using Node.js and Express, providing RESTful APIs for car repair management. The system includes JWT authentication, role-based permissions, and support for walk-in repairs without car registration.

## Features
- Car and repair management
- JWT authentication for all API endpoints
- Role-based permission system
- Walk-in repairs (repairs without generatedCode/carId)
- Image upload with fallback validation
- Real-time repair tracking
- Worker login system

## Installation
To set up the backend locally, follow these steps:

1. Clone the repository: ```git clone https://github.com/Cominde/fixer_backend.git```
2. Navigate into the project directory: ```cd fixer_backend```
3. Install dependencies: ```npm install```
4. Set up environment variables (see Environment Variables).
5. Start the development server: ```npm run dev```
   
## Environment Variables
The following environment variables are required to run the backend service:

DB_HOST: Host of the database.
DB_USER: Username for the database.
DB_PASS: Password for the database.
DB_NAME: Name of the database.
PORT: Port on which the server will run.
JWT_SECRET: Secret key for JWT token generation.
JWT_EXPIRES_IN: JWT token expiration time.

Create a .env file in the root directory and fill in the required variables.

## Usage
Run the backend server in development mode:
```npm run dev```

## Authentication
**IMPORTANT: All API endpoints require JWT authentication.**

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### Authentication
- POST /api/V1/auth/login - User login
- POST /api/V1/auth/register - User registration
- POST /api/V1/auth/worker-login - Worker login

### Cars
- GET /api/V1/Garage - Get all cars
- GET /api/V1/Garage/:id - Get specific car by ID
- POST /api/V1/Garage - Add new car
- PUT /api/V1/Garage/updateCar/:id - Update car
- DELETE /api/V1/Garage/:id - Delete car
- GET /api/V1/Garage/repairing - Get repairing cars

### Repairs
- GET /api/V1/repairing/getById/:id - Get repairs by car ID
- POST /api/V1/repairing - Create new repair
- PUT /api/V1/repairing/:id - Update repair
- GET /api/V1/repairing/walk-in - Get walk-in repairs

### Roles & Permissions
- GET /api/V1/roles - Get all roles
- POST /api/V1/roles - Create new role
- PUT /api/V1/roles/:id - Update role
- GET /api/V1/permissions - Get all permissions

## Contributing
We welcome contributions! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch: ```git checkout -b feature-name```.
3. Make your changes and commit them: ```git commit -m 'Add some feature'```.
4. Push to the branch: ```git push origin feature-name```.
5. Open a pull request.
   
## License
This project is licensed under the MIT License. See the LICENSE file for details.
