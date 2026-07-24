# WebAuthn Passkey Authentication Implementation

## 🎯 Overview

This implementation adds secure WebAuthn passkey authentication for admin users while maintaining backward compatibility with existing password-based login. Passkeys provide phishing-resistant, passwordless authentication using biometrics or device PINs.

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# WebAuthn Configuration
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Fixer Admin
WEBAUTHN_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:4100
```

**Production Example:**
```env
WEBAUTHN_RP_ID=yourdomain.com
WEBAUTHN_RP_NAME=Your App Name
WEBAUTHN_ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

## 📦 Dependencies

```bash
npm install base64url
```

## 🏗️ Architecture

### Data Models

#### Passkey Model (`models/passkeyModel.js`)
```javascript
{
  userId: ObjectId,           // Reference to User
  credentialId: String,       // Unique credential identifier
  publicKey: String,          // Public key for verification
  counter: Number,           // Signature counter
  transports: [String],      // Supported transports
  aaguid: String,            // Authenticator AAGUID
  label: String,             // User-friendly name
  createdAt: Date,
  lastUsedAt: Date,
  revokedAt: Date            // Soft delete
}
```

#### Challenge Model (`models/challengeModel.js`)
```javascript
{
  challenge: String,         // Random challenge
  type: String,             // 'register' or 'login'
  userId: ObjectId,         // User reference (optional for login)
  email: String,            // Email reference (for login challenges)
  expiresAt: Date,          // Auto-expiration
  usedAt: Date              // Mark as used
}
```

### Endpoints

#### Registration (Authenticated)
- `POST /api/V2/auth/admin/passkey/register/begin` - Create registration challenge
- `POST /api/V2/auth/admin/passkey/register/finish` - Complete registration

#### Login (Public)
- `POST /api/V2/auth/admin/passkey/login/begin` - Create login challenge
- `POST /api/V2/auth/admin/passkey/login/finish` - Complete login

#### Management (Authenticated)
- `GET /api/V2/auth/admin/passkey/list` - List user passkeys
- `POST /api/V2/auth/admin/passkey/revoke` - Revoke passkey

## 🔒 Security Features

### 1. Challenge-Based Authentication
- Random challenges generated for each operation
- Challenges expire after 5 minutes
- Single-use challenges prevent replay attacks

### 2. Origin Validation
- Strict origin checking against allowed origins
- Prevents cross-origin attacks
- Configurable per environment

### 3. RP ID Validation
- Ensures credentials are used for correct domain
- Prevents credential phishing

### 4. Counter Replay Protection
- Monitors signature counter values
- Detects and prevents replay attacks
- Stores last used counter per passkey

### 5. User Isolation
- Passkeys are bound to specific users
- Challenges are user-specific
- Prevents credential sharing

### 6. Secure Storage
- Public keys stored securely in database
- Private keys never leave authenticator
- Soft delete for passkey revocation

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Add environment variables to .env
echo "WEBAUTHN_RP_ID=localhost" >> .env
echo "WEBAUTHN_RP_NAME=Fixer Admin" >> .env
echo "WEBAUTHN_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:4100" >> .env

# Install dependencies
npm install base64url

# Restart server
node server.js
```

### 2. Register First Passkey
```javascript
// 1. Login with password to get JWT token
const loginResponse = await fetch('/api/V2/auth/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await loginResponse.json();

// 2. Begin registration
const registerBegin = await fetch('/api/V2/auth/admin/passkey/register/begin', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ origin: window.location.origin })
});
const { data } = await registerBegin.json();

// 3. Create credential with WebAuthn API
const credential = await navigator.credentials.create({
  publicKey: data
});

// 4. Complete registration
const registerFinish = await fetch('/api/V2/auth/admin/passkey/register/finish', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    credential: {
      id: credential.id,
      rawId: arrayBufferToBase64(credential.rawId),
      response: {
        attestationObject: arrayBufferToBase64(credential.response.attestationObject),
        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON)
      },
      type: credential.type
    },
    origin: window.location.origin,
    clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON)
  })
});
```

### 3. Login with Passkey
```javascript
// 1. Begin login
const loginBegin = await fetch('/api/V2/auth/admin/passkey/login/begin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: user.email,
    origin: window.location.origin 
  })
});
const { data } = await loginBegin.json();

// 2. Get credential with WebAuthn API
const credential = await navigator.credentials.get({
  publicKey: data
});

// 3. Complete login
const loginFinish = await fetch('/api/V2/auth/admin/passkey/login/finish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credential: {
      id: credential.id,
      response: {
        authenticatorData: arrayBufferToBase64(credential.response.authenticatorData),
        clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
        signature: arrayBufferToBase64(credential.response.signature)
      },
      type: credential.type
    },
    origin: window.location.origin,
    clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON)
  })
});
const { token, user } = await loginFinish.json();
```

## 🧪 Testing

### Automated Tests
```bash
# Run WebAuthn tests
npm test -- tests/webauthn.test.js

# Run all tests
npm test
```

### Manual Testing
See `test-webauthn-guide.md` for detailed manual testing instructions.

### Browser Testing
Use the HTML test page in the testing guide to test real WebAuthn flows.

## 📊 Response Formats

### Success Response (Login)
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "id": "user_id",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin"
    }
  }
}
```

### Error Response
```json
{
  "status": "fail",
  "message": "Challenge has expired"
}
```

## 🔧 Configuration Options

### Environment Variables
- `WEBAUTHN_RP_ID`: Relying Party ID (usually domain)
- `WEBAUTHN_RP_NAME`: Human-readable name for the service
- `WEBAUTHN_ALLOWED_ORIGINS`: Comma-separated list of allowed origins

### Challenge Expiration
Default: 5 minutes. Can be customized in service functions.

### Supported Algorithms
- ES256 (-7): Elliptic Curve Digital Signature Algorithm
- RS256 (-257): RSA Signature Algorithm

## 🚨 Important Notes

### Production Requirements
1. **HTTPS Required**: WebAuthn requires HTTPS in production
2. **Valid Domain**: RP ID must match your domain
3. **Proper Origins**: Configure allowed origins for your domains

### Browser Support
- Chrome 67+
- Firefox 60+
- Edge 18+
- Safari 14+ (limited support)

### Security Considerations
1. **Never expose private keys**: They stay in the authenticator
2. **Validate all inputs**: Server validates all client data
3. **Use HTTPS**: Required for WebAuthn security
4. **Monitor challenges**: Auto-expire and single-use
5. **Secure storage**: Public keys stored securely in database

### Performance Considerations
- Challenges auto-expire via MongoDB TTL index
- Efficient database queries with proper indexing
- Minimal memory usage with connection cleanup

## 🐛 Troubleshooting

### Common Issues

1. **"Origin not allowed"**
   - Check `WEBAUTHN_ALLOWED_ORIGINS` environment variable
   - Ensure origin matches exactly (including protocol and port)

2. **"RP ID mismatch"**
   - Verify `WEBAUTHN_RP_ID` matches your domain
   - Check that RP ID is the effective domain (no subdomains unless included)

3. **"Challenge expired"**
   - Challenges expire after 5 minutes
   - Ensure client completes flow within time limit

4. **"Passkey not found"**
   - Verify passkey was registered successfully
   - Check if passkey was revoked

### Debug Tips
- Check browser console for WebAuthn errors
- Verify environment variables are set correctly
- Monitor server logs for detailed error information
- Use network tab to inspect API requests/responses

## 📚 Additional Resources

- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [WebAuthn Guide](https://webauthn.guide/)
- [Passkey Documentation](https://developers.google.com/identity/passkeys)

## 🔄 Migration Guide

### From Password-Only
1. Deploy WebAuthn endpoints alongside existing auth
2. Add passkey registration UI for existing users
3. Gradually encourage passkey adoption
4. Keep password login as fallback option

### Database Changes
- New collections: `passkeys`, `challenges`
- No changes to existing `users` collection
- Automatic indexing via schema definitions

## 📈 Monitoring

### Key Metrics
- Passkey registration rate
- Passkey login success rate
- Challenge expiration rate
- Failed authentication attempts

### Logging
- All WebAuthn operations logged with correlation IDs
- Security events (replay attacks, origin violations)
- Performance metrics (response times, error rates)

## 🛡️ Security Best Practices

1. **Regular Security Updates**: Keep dependencies updated
2. **Monitor for Attacks**: Watch for unusual patterns
3. **Secure Storage**: Encrypt sensitive data at rest
4. **Rate Limiting**: Implement rate limiting on endpoints
5. **Audit Logs**: Maintain comprehensive audit trails
6. **Regular Testing**: Test security controls regularly
