<img src="https://skillicons.dev/icons?i=nodejs,powershell,npm" />
<br>
# Fixer Backend
The backend service for Fixer, a platform that provides reliable currency exchange rates, currency conversions, and other financial data services.

## Table of Contents
1. Overview
2. Features
3. Installation
4. Environment Variables
5. Usage
6. API Endpoints
7. Contributing
8. License

## Overview
Fixer Backend is built using Node.js and Express, providing RESTful APIs for currency-related functionalities. The platform integrates with external APIs to deliver accurate exchange rates and conversion services. It is designed to be scalable and efficient for handling financial data.

## Features
Real-time currency exchange rates: Get the latest exchange rates from various sources.
Currency conversion: Convert amounts between different currencies with ease.
Historical rates: Retrieve exchange rates for specific dates in the past.
Automated updates: Rates are updated periodically from external providers.
Secure and scalable: Designed with security best practices and scalability in mind.
Installation
To set up the backend locally, follow these steps:

1. Clone the repository: ```git clone https://github.com/Cominde/fixer_backend.git```
2. Navigate into the project directory: ```cd fixer_backend```
3. Install dependencies: ```npm install```
4. Set up environment variables (see Environment Variables).
5. Start the development server: ```npm run dev```
   
## Environment Variables
The following environment variables are required to run the backend service:

API_KEY: Your API key for the external currency exchange rate provider.
DB_HOST: Host of the database.
DB_USER: Username for the database.
DB_PASS: Password for the database.
DB_NAME: Name of the database.
PORT: Port on which the server will run.
Create a .env file in the root directory and fill in the required variables.

Example .env file:
````
API_KEY=your_api_key
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=fixer_db
PORT=3000
````

## Usage
Run the backend server in development mode:
```npm run dev```
This will start the backend server at http://localhost:3000.

## API Endpoints
Below are some example API endpoints provided by the Fixer Backend:

GET /api/rates: Retrieve the latest currency exchange rates.

POST /api/convert: Convert amounts between currencies.

GET /api/historical?date=YYYY-MM-DD: Retrieve historical exchange rates for a specific date.

For a full list of available endpoints and their usage, refer to the API documentation (if available).

## Contributing
We welcome contributions! Please follow these steps to contribute:

## Fork the repository.
1. Create a new branch: ```git checkout -b feature-name```.
2. Make your changes and commit them: ```git commit -m 'Add some feature'```.
3. Push to the branch: ```git push origin feature-name```.
4. Open a pull request.
   
## License
This project is licensed under the MIT License. See the LICENSE file for details.
