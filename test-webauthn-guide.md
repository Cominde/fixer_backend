# WebAuthn Passkey Authentication Testing Guide

## 🚀 Quick Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Fixer Admin
WEBAUTHN_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:4100
```

### 2. Install Dependencies

```bash
npm install base64url
```

### 3. Restart Server

```bash
# Stop current server (Ctrl+C) and restart
node server.js
```

## 🧪 Testing Endpoints

### Prerequisites

- Server running on port 4000
- Admin user exists in database
- Valid JWT token for authenticated endpoints

### 1. Begin Passkey Registration (Authenticated)

```bash
# First login with password to get JWT token
curl -X POST "http://localhost:4000/api/V2/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'

# Use the returned token to begin registration
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/register/begin" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_JWT_TOKEN" -d '{"origin":"http://localhost:3000"}'
```

**Expected Response:**

```json
{
  "status": "success",
  "data": {
    "challenge": "base64url_encoded_challenge",
    "rp": {
      "name": "Fixer Admin",
      "id": "localhost"
    },
    "user": {
      "id": "user_id",
      "name": "admin@example.com",
      "displayName": "Admin User"
    },
    "pubKeyCredParams": [
      { "alg": -7, "type": "public-key" },
      { "alg": -257, "type": "public-key" }
    ],
    "timeout": 60000,
    "attestation": "direct",
    "authenticatorSelection": {
      "authenticatorAttachment": "platform",
      "userVerification": "required",
      "requireResidentKey": true
    }
  }
}
```

### 2. Test Registration with Mock Data

```bash
# Simulate browser response (use real WebAuthn API in production)
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/register/finish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "credential": {
      "id": "mock_credential_id",
      "rawId": "mock_raw_id",
      "response": {
        "attestationObject": "mock_attestation",
        "clientDataJSON": "mock_client_data"
      },
      "type": "public-key"
    },
    "origin": "http://localhost:3000",
    "clientDataJSON": "{\"type\":\"webauthn.create\",\"challenge\":\"challenge_from_step1\",\"origin\":\"http://localhost:3000\",\"rpId\":\"localhost\"}"
  }'
```

### 3. Begin Passkey Login (Public)

```bash
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/login/begin" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","origin":"http://localhost:3000"}'
```

**Expected Response:**

```json
{
  "status": "success",
  "data": {
    "allowCredentials": [
      {
        "id": "stored_credential_id",
        "type": "public-key",
        "transports": ["internal", "usb", "nfc", "ble"]
      }
    ],
    "challenge": "base64url_encoded_challenge",
    "userVerification": "required"
  }
}
```

### 4. Test Login with Mock Data

```bash
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/login/finish" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": {
      "id": "stored_credential_id",
      "response": {
        "authenticatorData": "mock_authenticator_data",
        "clientDataJSON": "mock_client_data",
        "signature": "mock_signature"
      },
      "type": "public-key"
    },
    "origin": "http://localhost:3000",
    "clientDataJSON": "{\"type\":\"webauthn.get\",\"challenge\":\"challenge_from_step3\",\"origin\":\"http://localhost:3000\",\"rpId\":\"localhost\"}"
  }'
```

### 5. List User Passkeys

```bash
curl -X GET "http://localhost:4000/api/V2/auth/admin/passkey/list" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Revoke Passkey

```bash
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/revoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"credentialId":"credential_id_to_revoke"}'
```

## 🔧 Error Testing Scenarios

### Test Expired Challenge

```bash
# Use an old challenge or wait 5+ minutes
# Expected: {"status": "fail", "message": "Challenge has expired"}
```

### Test Wrong Origin

```bash
# Use different origin in request
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/login/begin" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","origin":"http://malicious.com"}'
# Expected: {"status": "fail", "message": "Origin not allowed"}
```

### Test Replay Challenge

```bash
# Use same challenge twice
# Expected: {"status": "fail", "message": "Challenge already used"}
```

### Test Non-existent User

```bash
curl -X POST "http://localhost:4000/api/V2/auth/admin/passkey/login/begin" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","origin":"http://localhost:3000"}'
# Expected: Returns empty allowCredentials array (security)
```

## 🌐 Browser Testing (Real WebAuthn)

### HTML Test Page

Create `test-webauthn.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>WebAuthn Test</title>
  </head>
  <body>
    <h1>WebAuthn Passkey Test</h1>

    <div>
      <h2>1. Login with Password First</h2>
      <input type="email" id="email" placeholder="Email" />
      <input type="password" id="password" placeholder="Password" />
      <button onclick="loginWithPassword()">Login</button>
      <div id="loginResult"></div>
    </div>

    <div>
      <h2>2. Register Passkey</h2>
      <button onclick="beginPasskeyRegistration()">Begin Registration</button>
      <div id="registerResult"></div>
    </div>

    <div>
      <h2>3. Test Passkey Login</h2>
      <button onclick="beginPasskeyLogin()">Begin Passkey Login</button>
      <div id="passkeyLoginResult"></div>
    </div>

    <script>
      let authToken = "";

      async function loginWithPassword() {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
          const response = await fetch(
            "http://localhost:4000/api/V2/auth/admin/login",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            },
          );

          const result = await response.json();
          if (result.token) {
            authToken = result.token;
            document.getElementById("loginResult").innerHTML =
              "✅ Login successful! Token saved.";
          } else {
            document.getElementById("loginResult").innerHTML =
              "❌ Login failed: " + (result.message || "Unknown error");
          }
        } catch (error) {
          document.getElementById("loginResult").innerHTML =
            "❌ Error: " + error.message;
        }
      }

      async function beginPasskeyRegistration() {
        if (!authToken) {
          alert("Please login with password first");
          return;
        }

        try {
          const response = await fetch(
            "http://localhost:4000/api/V2/auth/admin/passkey/register/begin",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ origin: window.location.origin }),
            },
          );

          const result = await response.json();

          if (result.status === "success") {
            // Use real WebAuthn API
            const credential = await navigator.credentials.create({
              publicKey: result.data,
            });

            // Finish registration
            const finishResponse = await fetch(
              "http://localhost:4000/api/V2/auth/admin/passkey/register/finish",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  credential: {
                    id: credential.id,
                    rawId: arrayBufferToBase64(credential.rawId),
                    response: {
                      attestationObject: arrayBufferToBase64(
                        credential.response.attestationObject,
                      ),
                      clientDataJSON: arrayBufferToBase64(
                        credential.response.clientDataJSON,
                      ),
                    },
                    type: credential.type,
                  },
                  origin: window.location.origin,
                  clientDataJSON: arrayBufferToBase64(
                    credential.response.clientDataJSON,
                  ),
                }),
              },
            );

            const finishResult = await finishResponse.json();
            document.getElementById("registerResult").innerHTML =
              finishResult.status === "success"
                ? "✅ Passkey registered successfully!"
                : "❌ Registration failed: " + finishResult.message;
          }
        } catch (error) {
          document.getElementById("registerResult").innerHTML =
            "❌ Error: " + error.message;
        }
      }

      async function beginPasskeyLogin() {
        try {
          const response = await fetch(
            "http://localhost:4000/api/V2/auth/admin/passkey/login/begin",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: document.getElementById("email").value,
                origin: window.location.origin,
              }),
            },
          );

          const result = await response.json();

          if (result.status === "success") {
            // Use real WebAuthn API
            const credential = await navigator.credentials.get({
              publicKey: result.data,
            });

            // Finish login
            const finishResponse = await fetch(
              "http://localhost:4000/api/V2/auth/admin/passkey/login/finish",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  credential: {
                    id: credential.id,
                    response: {
                      authenticatorData: arrayBufferToBase64(
                        credential.response.authenticatorData,
                      ),
                      clientDataJSON: arrayBufferToBase64(
                        credential.response.clientDataJSON,
                      ),
                      signature: arrayBufferToBase64(
                        credential.response.signature,
                      ),
                    },
                    type: credential.type,
                  },
                  origin: window.location.origin,
                  clientDataJSON: arrayBufferToBase64(
                    credential.response.clientDataJSON,
                  ),
                }),
              },
            );

            const finishResult = await finishResponse.json();
            document.getElementById("passkeyLoginResult").innerHTML =
              finishResult.status === "success"
                ? "✅ Passkey login successful! Token: " +
                  finishResult.token.substring(0, 20) +
                  "..."
                : "❌ Login failed: " + finishResult.message;
          }
        } catch (error) {
          document.getElementById("passkeyLoginResult").innerHTML =
            "❌ Error: " + error.message;
        }
      }

      function arrayBufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
      }
    </script>
  </body>
</html>
```

## 📊 Database Verification

### Check Passkeys Collection

```javascript
// In MongoDB shell
db.passkeys.find().pretty();
```

### Check Challenges Collection

```javascript
// In MongoDB shell
db.challenges.find().pretty();
```

## 🚨 Important Notes

1. **HTTPS Required**: WebAuthn requires HTTPS in production
2. **Browser Support**: Test in Chrome/Firefox/Edge (Safari has limited support)
3. **Security**: Never expose sensitive data in production
4. **Testing**: Use mock data for API testing, real WebAuthn for browser testing
5. **Cleanup**: Challenges auto-expire after 5 minutes

## 🔍 Debug Tips

- Check browser console for WebAuthn errors
- Verify environment variables are set correctly
- Ensure MongoDB indexes are created properly
- Check server logs for detailed error messages
- Use network tab to inspect API requests/responses
