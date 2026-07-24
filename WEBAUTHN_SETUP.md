# WebAuthn Passkey Configuration

## Required Environment Variables

For passkey authentication to work correctly in production, set these environment variables in your Render dashboard:

### Production Configuration (fixer-admin.cominde.org)

```bash
WEBAUTHN_RP_ID=cominde.org
WEBAUTHN_RP_NAME=Fixer
WEBAUTHN_ALLOWED_ORIGINS=https://fixer-admin.cominde.org
```

### Development Configuration (localhost)

```bash
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Fixer
WEBAUTHN_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:4100,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:*,http://localhost:*
```

## Configuration Details

### RP_ID (Relying Party ID)
- **Production**: `cominde.org` - Covers both `fixer-admin.cominde.org` and `fixer.cominde.org` subdomains
- **Development**: `localhost` - For local testing
- **Purpose**: The domain that passkeys are bound to. Must be a registrable domain suffix of the page origin.

### RP_NAME (Relying Party Name)
- **Production**: `Fixer`
- **Development**: `Fixer`
- **Purpose**: Human-readable name displayed during passkey registration/login.

### ALLOWED_ORIGINS
- **Production**: `https://fixer-admin.cominde.org` - Exact origin for admin panel
- **Development**: Comma-separated list of localhost origins for testing
- **Purpose**: Whitelist of origins allowed to make WebAuthn requests.

## Backend Changes Made

### 1. Fixed authenticatorSelection.residentKey
- **Changed from**: `requireResidentKey: true` (invalid)
- **Changed to**: `residentKey: "preferred"` (valid)
- **Location**: `services/webauthnService.js` line 228
- **Reason**: WebAuthn spec requires valid enum value: `"discouraged" | "preferred" | "required"`

### 2. Added rpId to login options
- **Added**: `rpId: RP_ID` to login/begin response
- **Location**: `services/webauthnService.js` line 342
- **Reason**: Consistency with registration endpoint; browser defaults to host but explicit is better

### 3. Updated default configuration
- **RP_ID default**: Changed from `"localhost"` to `"cominde.org"`
- **RP_NAME default**: Changed from `"Fixer Admin"` to `"Fixer"`
- **Location**: `services/webauthnService.js` lines 13-14
- **Reason**: Production-ready defaults for the cominde.org domain

## Security Notes

### RP ID Security
- Passkeys are bound to the RP ID domain
- Using `cominde.org` allows passkey sharing between subdomains
- If you want isolation between admin and main app, use `fixer-admin.cominde.org` instead

### Origin Validation
- Origins must exactly match or be explicitly allowed
- The backend validates origins against `ALLOWED_ORIGINS` on every request
- Invalid origins return 403 error

### Passkey Registration Flow
1. Frontend calls `POST /auth/admin/passkey/register/begin` with origin
2. Backend validates origin and returns WebAuthn options
3. Frontend creates passkey using browser WebAuthn API
4. Frontend calls `POST /auth/admin/passkey/register/finish` with credential
5. Backend verifies and stores passkey

### Passkey Login Flow
1. Frontend calls `POST /auth/admin/passkey/login/begin` with email and origin
2. Backend validates origin and returns challenge + allowed credentials
3. Frontend authenticates using stored passkey
4. Frontend calls `POST /auth/admin/passkey/login/finish` with credential
5. Backend verifies signature and returns JWT token

## Troubleshooting

### "Origin not allowed" error
- Check `WEBAUTHN_ALLOWED_ORIGINS` environment variable
- Ensure the exact origin (including protocol) is in the list
- Check server logs for the actual origin being sent

### "Ignoring unknown authenticatorSelection.residentKey value" warning
- This is now fixed with `residentKey: "preferred"`
- Clear browser cache and re-register passkey

### Passkey registration fails
- Ensure RP_ID is a registrable domain suffix of the origin
- Check that origin validation passes
- Verify browser supports WebAuthn (modern browsers only)

### Passkey login fails
- Ensure passkey was registered with the same RP_ID
- Check that the origin matches registration origin
- Verify passkey hasn't been revoked

## Testing

### Local Development
1. Set environment variables for localhost
2. Navigate to `http://localhost:3000` (or your dev port)
3. Register passkey
4. Test login with passkey

### Production Testing
1. Set environment variables in Render dashboard
2. Deploy changes
3. Navigate to `https://fixer-admin.cominde.org`
4. Register new passkey (old passkeys with different RP_ID won't work)
5. Test login with new passkey
