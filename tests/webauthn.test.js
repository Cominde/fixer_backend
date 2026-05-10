const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/userModel');
const Passkey = require('../models/passkeyModel');
const Challenge = require('../models/challengeModel');
const jwt = require('jsonwebtoken');

describe('WebAuthn Passkey Authentication', () => {
  let testUser;
  let authToken;
  const testEmail = 'webauthn@example.com';
  const testPassword = 'testpassword123';
  const testOrigin = 'http://localhost:3000';

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test';
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: /webauthn.*@example\.com/ } });
    await Passkey.deleteMany({});
    await Challenge.deleteMany({});

    // Create test admin user
    testUser = await User.create({
      name: 'WebAuthn Test User',
      email: testEmail,
      password: testPassword,
      phoneNumber: '+1234567890',
      vertified: true,
      role: 'admin'
    });

    // Generate auth token
    authToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET_KEY);
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: /webauthn.*@example\.com/ } });
    await Passkey.deleteMany({});
    await Challenge.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/V2/auth/admin/passkey/register/begin', () => {
    test('should create registration challenge for authenticated user', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/begin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ origin: testOrigin })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.challenge).toBeDefined();
      expect(response.body.data.rp).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBe(testUser._id.toString());
      expect(response.body.data.user.name).toBe(testEmail);
    });

    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/begin')
        .send({ origin: testOrigin })
        .expect(401);

      expect(response.body.message).toContain('login');
    });

    test('should reject missing origin', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/begin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Origin is required');
    });

    test('should reject invalid origin', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/begin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ origin: 'http://malicious.com' })
        .expect(403);

      expect(response.body.message).toContain('Origin not allowed');
    });
  });

  describe('POST /api/V2/auth/admin/passkey/register/finish', () => {
    test('should complete passkey registration successfully', async () => {
      // First, create a challenge
      const beginResponse = await request(app)
        .post('/api/V2/auth/admin/passkey/register/begin')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ origin: testOrigin });

      const challenge = beginResponse.body.data.challenge;
      const mockCredential = {
        id: 'mock_credential_id',
        rawId: 'mock_raw_id',
        response: {
          attestationObject: 'mock_attestation',
          clientDataJSON: JSON.stringify({
            type: 'webauthn.create',
            challenge: challenge,
            origin: testOrigin,
            rpId: 'localhost'
          })
        },
        type: 'public-key'
      };

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: mockCredential,
          origin: testOrigin,
          clientDataJSON: mockCredential.response.clientDataJSON
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('registered successfully');

      // Verify passkey was created
      const passkey = await Passkey.findOne({ userId: testUser._id });
      expect(passkey).toBeTruthy();
      expect(passkey.credentialId).toBe('mock_credential_id');
    });

    test('should reject expired challenge', async () => {
      // Create an expired challenge
      await Challenge.create({
        challenge: 'expired_challenge',
        type: 'register',
        userId: testUser._id,
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: { id: 'test' },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.create',
            challenge: 'expired_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });

    test('should reject replayed challenge', async () => {
      // Create and use a challenge
      await Challenge.create({
        challenge: 'replay_challenge',
        type: 'register',
        userId: testUser._id,
        expiresAt: new Date(Date.now() + 60000),
        usedAt: new Date() // Already used
      });

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: { id: 'test' },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.create',
            challenge: 'replay_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('already used');
    });

    test('should reject wrong client data type', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: { id: 'test' },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'wrong_type',
            challenge: 'test_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid client data type');
    });

    test('should reject origin mismatch', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: { id: 'test' },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.create',
            challenge: 'test_challenge',
            origin: 'http://different.com',
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Origin mismatch');
    });

    test('should reject wrong RP ID', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/register/finish')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential: { id: 'test' },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.create',
            challenge: 'test_challenge',
            origin: testOrigin,
            rpId: 'wrong-rp-id'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('RP ID mismatch');
    });
  });

  describe('POST /api/V2/auth/admin/passkey/login/begin', () => {
    test('should create login challenge for existing user', async () => {
      // Create a passkey for the user first
      await Passkey.create({
        userId: testUser._id,
        credentialId: 'test_credential_id',
        publicKey: 'test_public_key',
        counter: 0,
        transports: ['internal']
      });

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/begin')
        .send({ email: testEmail, origin: testOrigin })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.challenge).toBeDefined();
      expect(response.body.data.allowCredentials).toHaveLength(1);
      expect(response.body.data.allowCredentials[0].id).toBe('test_credential_id');
    });

    test('should handle non-existent user gracefully', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/begin')
        .send({ email: 'nonexistent@example.com', origin: testOrigin })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.allowCredentials).toHaveLength(0);
      expect(response.body.data.challenge).toBeDefined();
    });

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/begin')
        .send({ email: 'invalid-email', origin: testOrigin })
        .expect(400);

      expect(response.body.message).toContain('Invalid email format');
    });

    test('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/begin')
        .send({ origin: testOrigin })
        .expect(400);

      expect(response.body.message).toContain('Email and origin are required');
    });

    test('should reject invalid origin', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/begin')
        .send({ email: testEmail, origin: 'http://malicious.com' })
        .expect(403);

      expect(response.body.message).toContain('Origin not allowed');
    });
  });

  describe('POST /api/V2/auth/admin/passkey/login/finish', () => {
    beforeEach(async () => {
      // Create a passkey for testing
      await Passkey.create({
        userId: testUser._id,
        credentialId: 'test_login_credential',
        publicKey: 'test_public_key',
        counter: 0,
        transports: ['internal']
      });
    });

    test('should complete login successfully', async () => {
      // Create login challenge
      await Challenge.create({
        challenge: 'login_challenge',
        type: 'login',
        userId: testUser._id,
        expiresAt: new Date(Date.now() + 60000)
      });

      const mockCredential = {
        id: 'test_login_credential',
        response: {
          authenticatorData: 'mock_auth_data',
          clientDataJSON: JSON.stringify({
            type: 'webauthn.get',
            challenge: 'login_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          }),
          signature: 'mock_signature'
        },
        type: 'public-key'
      };

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: mockCredential,
          origin: testOrigin,
          clientDataJSON: mockCredential.response.clientDataJSON
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.email).toBe(testEmail);
    });

    test('should reject non-existent passkey', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: {
            id: 'non_existent_credential',
            response: { authenticatorData: 'test', clientDataJSON: '{}', signature: 'test' },
            type: 'public-key'
          },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.get',
            challenge: 'test',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Passkey not found');
    });

    test('should reject invalid challenge', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: {
            id: 'test_login_credential',
            response: { authenticatorData: 'test', clientDataJSON: '{}', signature: 'test' },
            type: 'public-key'
          },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.get',
            challenge: 'invalid_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid or expired challenge');
    });

    test('should reject wrong client data type', async () => {
      await Challenge.create({
        challenge: 'login_challenge_2',
        type: 'login',
        userId: testUser._id,
        expiresAt: new Date(Date.now() + 60000)
      });

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: {
            id: 'test_login_credential',
            response: { authenticatorData: 'test', clientDataJSON: '{}', signature: 'test' },
            type: 'public-key'
          },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'wrong_type',
            challenge: 'login_challenge_2',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid client data type');
    });
  });

  describe('GET /api/V2/auth/admin/passkey/list', () => {
    test('should list user passkeys', async () => {
      // Create test passkeys
      await Passkey.create({
        userId: testUser._id,
        credentialId: 'passkey_1',
        publicKey: 'key_1',
        counter: 0,
        transports: ['internal'],
        label: 'Passkey 1'
      });

      await Passkey.create({
        userId: testUser._id,
        credentialId: 'passkey_2',
        publicKey: 'key_2',
        counter: 0,
        transports: ['usb'],
        label: 'Passkey 2'
      });

      const response = await request(app)
        .get('/api/V2/auth/admin/passkey/list')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.passkeys).toHaveLength(2);
      expect(response.body.data.passkeys[0].credentialId).toBe('passkey_1');
      expect(response.body.data.passkeys[0].publicKey).toBeUndefined(); // Should be excluded
    });

    test('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/V2/auth/admin/passkey/list')
        .expect(401);

      expect(response.body.message).toContain('login');
    });
  });

  describe('POST /api/V2/auth/admin/passkey/revoke', () => {
    test('should revoke passkey successfully', async () => {
      // Create test passkey
      const passkey = await Passkey.create({
        userId: testUser._id,
        credentialId: 'passkey_to_revoke',
        publicKey: 'key_to_revoke',
        counter: 0,
        transports: ['internal']
      });

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ credentialId: 'passkey_to_revoke' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('revoked successfully');

      // Verify passkey is revoked
      const revokedPasskey = await Passkey.findById(passkey._id);
      expect(revokedPasskey.revokedAt).toBeTruthy();
    });

    test('should reject revoking non-existent passkey', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ credentialId: 'non_existent' })
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    test('should reject missing credential ID', async () => {
      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/revoke')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Credential ID is required');
    });
  });

  describe('Security Tests', () => {
    test('should prevent counter replay attack', async () => {
      // Create passkey with counter 10
      await Passkey.create({
        userId: testUser._id,
        credentialId: 'counter_test_credential',
        publicKey: 'test_key',
        counter: 10,
        transports: ['internal']
      });

      // Create login challenge
      await Challenge.create({
        challenge: 'counter_challenge',
        type: 'login',
        userId: testUser._id,
        expiresAt: new Date(Date.now() + 60000)
      });

      // Mock authenticator data with counter 5 (lower than stored)
      const mockAuthData = Buffer.alloc(37);
      mockAuthData.writeUInt32BE(5, 33); // Set counter to 5

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: {
            id: 'counter_test_credential',
            response: {
              authenticatorData: mockAuthData.toString('base64'),
              clientDataJSON: JSON.stringify({
                type: 'webauthn.get',
                challenge: 'counter_challenge',
                origin: testOrigin,
                rpId: 'localhost'
              }),
              signature: 'mock_signature'
            },
            type: 'public-key'
          },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.get',
            challenge: 'counter_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('Counter replay attack');
    });

    test('should enforce challenge expiration', async () => {
      // Create challenge that expires in 1ms
      await Challenge.create({
        challenge: 'expiring_challenge',
        type: 'login',
        userId: testUser._id,
        expiresAt: new Date(Date.now() + 1)
      });

      // Wait for challenge to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .post('/api/V2/auth/admin/passkey/login/finish')
        .send({
          credential: {
            id: 'test_login_credential',
            response: { authenticatorData: 'test', clientDataJSON: '{}', signature: 'test' },
            type: 'public-key'
          },
          origin: testOrigin,
          clientDataJSON: JSON.stringify({
            type: 'webauthn.get',
            challenge: 'expiring_challenge',
            origin: testOrigin,
            rpId: 'localhost'
          })
        })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });
  });
});
