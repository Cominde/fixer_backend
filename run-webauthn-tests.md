# How to Run WebAuthn Tests

## 🧪 Using the Test Suite

The `tests/webauthn.test.js` file provides comprehensive automated testing for your WebAuthn implementation.

### 1. Install Test Dependencies

```bash
npm install --save-dev supertest
```

### 2. Set Test Environment

Add to your `.env` file:
```env
MONGODB_TEST_URI=mongodb://localhost:27017/test
JWT_SECRET_KEY=your_test_secret_here
```

### 3. Run All Tests

```bash
# Run all WebAuthn tests
npm test -- tests/webauthn.test.js

# Run all tests in the project
npm test
```

### 4. Run Specific Test Groups

```bash
# Run only registration tests
npm test -- tests/webauthn.test.js -- --grep "Begin Passkey Registration"

# Run only login tests  
npm test -- tests/webauthn.test.js -- --grep "Begin Passkey Login"

# Run security tests
npm test -- tests/webauthn.test.js -- --grep "Security Tests"
```

## 🎯 What the Tests Cover

### Registration Tests
- ✅ Create registration challenge for authenticated user
- ❌ Reject unauthenticated requests
- ❌ Reject missing origin
- ❌ Reject invalid origin
- ✅ Complete registration successfully
- ❌ Reject expired challenge
- ❌ Reject replayed challenge
- ❌ Reject wrong client data type
- ❌ Reject origin mismatch
- ❌ Reject wrong RP ID

### Login Tests
- ✅ Create login challenge for existing user
- ✅ Handle non-existent user gracefully
- ❌ Reject invalid email format
- ❌ Reject invalid origin
- ✅ Complete login successfully
- ❌ Reject non-existent passkey
- ❌ Reject invalid challenge
- ❌ Reject wrong client data type

### Management Tests
- ✅ List user passkeys
- ❌ Reject unauthenticated request
- ✅ Revoke passkey successfully
- ❌ Reject revoking non-existent passkey
- ❌ Reject missing credential ID

### Security Tests
- ❌ Prevent counter replay attack
- ❌ Enforce challenge expiration

## 🔍 Test Output Examples

### Successful Test Output
```
WebAuthn Passkey Authentication
  ✓ POST /api/V2/auth/admin/passkey/register/begin (200ms)
  ✓ should create registration challenge for authenticated user
  ✓ POST /api/V2/auth/admin/passkey/register/finish (150ms)
  ✓ should complete passkey registration successfully
  ✓ POST /api/V2/auth/admin/passkey/login/begin (45ms)
  ✓ should create login challenge for existing user
  ✓ POST /api/V2/auth/admin/passkey/login/finish (120ms)
  ✓ should complete login successfully
```

### Failed Test Output
```
WebAuthn Passkey Authentication
  ✗ POST /api/V2/auth/admin/passkey/register/begin (50ms)
  ✗ should reject unauthenticated request
    Expected status: 401
    Received status: 401
  ✗ POST /api/V2/auth/admin/passkey/login/begin (30ms)
  ✗ should reject invalid origin
    Expected status: 403
    Received status: 403
```

## 🚀 Quick Test Commands

### Test Registration Flow
```bash
# Test successful registration
npm test -- tests/webauthn.test.js -- --grep "should create registration challenge"

# Test registration security
npm test -- tests/webauthn.test.js -- --grep "Test Expired Challenge"
```

### Test Login Flow
```bash
# Test successful login
npm test -- tests/webauthn.test.js -- --grep "should complete login successfully"

# Test login security
npm test -- tests/webauthn.test.js -- --grep "Test Wrong Origin"
```

### Test All Security Scenarios
```bash
npm test -- tests/webauthn.test.js -- --grep "Security Tests"
```

## 🔧 Troubleshooting Test Issues

### Common Test Problems

1. **MongoDB Connection Error**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:27017
   ```
   **Solution**: Make sure MongoDB is running on localhost:27017

2. **JWT Secret Error**
   ```
   Error: JsonWebTokenError: invalid signature
   ```
   **Solution**: Set `JWT_SECRET_KEY` in `.env` file

3. **Port Already in Use**
   ```
   Error: listen EADDRINUSE :::4000
   ```
   **Solution**: Stop other server process or change port

4. **Module Not Found**
   ```
   Error: Cannot find module 'supertest'
   ```
   **Solution**: Run `npm install --save-dev supertest`

### Test Database Setup

Create test database and user:
```javascript
// In MongoDB shell
use test
db.users.insertOne({
  name: 'WebAuthn Test User',
  email: 'webauthn@example.com', 
  password: 'testpassword123',
  phoneNumber: '+1234567890',
  vertified: true,
  role: 'admin'
})
```

## 📊 Test Coverage

The test suite covers:
- ✅ All endpoint success scenarios
- ✅ All endpoint error scenarios  
- ✅ Security validation (origin, RP ID, challenges)
- ✅ Authentication middleware testing
- ✅ Database operations (create, find, update)
- ✅ Error handling and response formats

## 🎯 Integration with Manual Testing

1. **Run automated tests first** to verify backend logic
2. **Use HTML test interface** for browser WebAuthn testing
3. **Check server logs** for debugging information
4. **Verify database state** after tests complete

This comprehensive testing approach ensures your WebAuthn implementation is robust and secure before deploying to production.
