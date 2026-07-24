# SSE Email Verification API Documentation

## Overview

This API provides real-time email verification using Server-Sent Events (SSE). It allows frontend applications to automatically continue when a user verifies their email, eliminating the need for manual refresh or polling.

## Features

- **Real-time verification**: Instant notification when email is verified
- **Automatic cleanup**: Connections close after verification or timeout
- **Heartbeat/ping**: Prevents proxy timeouts with keep-alive signals
- **Multi-user isolation**: Events are never leaked between users
- **Race condition protection**: SSE events emitted only after DB commit
- **Immediate verification**: If user is already verified, event is sent immediately

## Endpoints

### 1. SSE Verification Stream

**Endpoint**: `GET /api/V2/sse/verify?email=<email>`

**Description**: Opens an SSE stream to monitor email verification status.

**Parameters**:
- `email` (required): User email to monitor

**Response Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Events**:

#### Initial Connection Event
```
event: verification
data: {"type":"verification","status":"pending","email":"user@example.com","verified":false,"timestamp":"2026-05-06T20:00:00.000Z","correlationId":"uuid","message":"Waiting for email verification"}
```

#### Verification Success Event
```
event: verification
data: {"type":"verification","status":"verified","email":"user@example.com","verified":true,"timestamp":"2026-05-06T20:00:00.000Z","correlationId":"uuid","token":"jwt_token","user":{...}}
```

#### Timeout Event (after 5 minutes)
```
event: verification
data: {"type":"verification","status":"timeout","email":"user@example.com","verified":false,"reason":"not_verified_within_window","timestamp":"2026-05-06T20:00:00.000Z","correlationId":"uuid"}
```

#### Heartbeat Event (every 20 seconds)
```
event: ping
data: {"type":"ping","ts":"2026-05-06T20:00:00.000Z","correlationId":"uuid"}
```

### 2. Connection Status

**Endpoint**: `GET /api/V2/sse/status?email=<email>`

**Description**: Check if an SSE connection is active for debugging.

**Response**:
```json
{
  "status": "connected",
  "email": "user@example.com",
  "correlationId": "uuid",
  "connectedAt": "2026-05-06T20:00:00.000Z"
}
```

## Usage Examples

### cURL

Open verification stream:
```bash
curl -N "https://test-fixer.onrender.com/api/V2/sse/verify?email=user@example.com"
```

Expected output when verified:
```
event: verification
data: {"type":"verification","status":"verified","email":"user@example.com","verified":true,"timestamp":"2026-05-06T20:00:00.000Z","correlationId":"abc-123","token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

### JavaScript (Browser)

```javascript
const email = 'user@example.com';
const eventSource = new EventSource(`/api/V2/sse/verify?email=${encodeURIComponent(email)}`);

eventSource.addEventListener('verification', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.status === 'verified') {
    console.log('Email verified!', data);
    // Store token and redirect to app
    localStorage.setItem('authToken', data.token);
    window.location.href = '/dashboard';
  } else if (data.status === 'timeout') {
    console.log('Verification timeout');
    eventSource.close();
    // Show timeout message to user
  }
});

eventSource.addEventListener('ping', (event) => {
  const data = JSON.parse(event.data);
  console.log('Heartbeat:', data.ts);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};
```

### JavaScript (Node.js)

```javascript
const EventSource = require('eventsource');

const email = 'user@example.com';
const eventSource = new EventSource(`https://test-fixer.onrender.com/api/V2/sse/verify?email=${encodeURIComponent(email)}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  if (data.type === 'verification' && data.status === 'verified') {
    console.log('User verified successfully');
    eventSource.close();
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

### Python

```python
import requests
import json

def monitor_verification(email):
    url = f"https://test-fixer.onrender.com/api/V2/sse/verify?email={email}"
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data = json.loads(line[6:])
                    print(f"Received: {data}")
                    
                    if data.get('type') == 'verification' and data.get('status') == 'verified':
                        print("Email verified successfully!")
                        token = data.get('token')
                        # Store token and proceed
                        break
                        
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

# Usage
monitor_verification('user@example.com')
```

### Flutter/Dart

```dart
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;

Future<void> monitorVerification(String email) async {
  final uri = Uri.parse(
    'https://test-fixer.onrender.com/api/V2/sse/verify?email=${Uri.encodeComponent(email)}'
  );
  
  try {
    final request = http.Request('GET', uri);
    final response = await request.send();
    
    await response.stream
        .transform(utf8.decoder)
        .transform(LineSplitter())
        .listen((line) {
      if (line.startsWith('data: ')) {
        final data = json.decode(line.substring(6));
        print('Received: $data');
        
        if (data['type'] == 'verification' && data['status'] == 'verified') {
          print('Email verified successfully!');
          final token = data['token'];
          // Store token and navigate to app
        }
      }
    });
  } catch (e) {
    print('Error: $e');
  }
}
```

## Integration with Login Flow

### Complete Frontend Flow

1. **User attempts login**
   ```javascript
   const loginResponse = await fetch('/api/V2/auth/admin/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email, password })
   });
   
   const loginData = await loginResponse.json();
   
   if (loginData.sseStatus === 'pending_verification') {
     // Start SSE monitoring
     startSseVerification(email);
   } else {
     // Login successful, proceed to app
     localStorage.setItem('authToken', loginData.token);
     window.location.href = '/dashboard';
   }
   ```

2. **Start SSE monitoring**
   ```javascript
   function startSseVerification(email) {
     const eventSource = new EventSource(`/api/V2/sse/verify?email=${encodeURIComponent(email)}`);
     
     eventSource.addEventListener('verification', (event) => {
       const data = JSON.parse(event.data);
       
       if (data.status === 'verified') {
         // Verification complete, proceed to app
         localStorage.setItem('authToken', data.token);
         eventSource.close();
         window.location.href = '/dashboard';
       }
     });
     
     eventSource.onerror = () => {
       eventSource.close();
       // Show error message, fallback to manual verification
     };
   }
   ```

3. **Manual verification fallback**
   ```javascript
   // Keep manual verify button as fallback
   document.getElementById('manualVerify').addEventListener('click', async () => {
     // Close SSE connection
     if (window.sseConnection) {
       window.sseConnection.close();
     }
     
     // Try login again
     const loginResponse = await fetch('/api/V2/auth/admin/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password })
     });
     
     const loginData = await loginResponse.json();
     if (loginData.token) {
       localStorage.setItem('authToken', loginData.token);
       window.location.href = '/dashboard';
     }
   });
   ```

## Error Handling

### Common Error Scenarios

1. **Invalid email format**
   ```json
   {
     "message": "Invalid email format"
   }
   ```

2. **User not found**
   ```json
   {
     "message": "User not found"
   }
   ```

3. **Missing email parameter**
   ```json
   {
     "message": "Email parameter is required"
   }
   ```

### Connection Issues

- **Network timeout**: Implement retry logic with exponential backoff
- **Server errors**: Show user-friendly error message and fallback to manual verification
- **Connection drops**: Automatically reconnect or show retry button

## Testing

### Manual Testing Steps

1. **Happy Path Test**
   ```bash
   # 1. Open SSE stream
   curl -N "http://localhost:4100/api/V2/sse/verify?email=test@example.com"
   
   # 2. In another terminal, verify email
   curl "http://localhost:4100/api/V2/auth/admin/verifyLogin?token=YOUR_TOKEN"
   
   # 3. Observe verification event in first terminal
   ```

2. **Already Verified Test**
   ```bash
   # Mark user as verified in DB first, then:
   curl -N "http://localhost:4100/api/V2/sse/verify?email=test@example.com"
   # Should receive immediate verification event
   ```

3. **Timeout Test**
   ```bash
   # Open stream without verifying
   curl -N "http://localhost:4100/api/V2/sse/verify?email=test@example.com"
   # Wait 5 minutes, should receive timeout event
   ```

### Automated Tests

Run the test suite:
```bash
npm test -- tests/sseVerification.test.js
```

## Security Considerations

1. **Email normalization**: All emails are normalized to lowercase and trimmed
2. **User isolation**: Events are only sent to the correct user's stream
3. **Rate limiting**: Implement rate limiting for SSE connections per IP/email
4. **Token validation**: Verification tokens are validated with expiry checks
5. **Input sanitization**: All inputs are validated and sanitized

## Performance Considerations

1. **Connection limits**: Monitor and limit concurrent SSE connections
2. **Memory usage**: Clean up closed connections promptly
3. **Database efficiency**: Verify user exists before establishing stream
4. **Proxy compatibility**: Heartbeat prevents proxy idle timeouts

## Monitoring

### Log Messages

The system logs important events with correlation IDs:

```
SSE client connected: user@example.com (correlation: abc-123)
User user@example.com verified successfully, SSE notification sent
Verification sent to user@example.com, closing connection
SSE client disconnected: user@example.com (correlation: abc-123)
```

### Metrics to Monitor

- Active SSE connections count
- Connection duration average
- Verification success rate
- Timeout rate
- Error rate by type

## Troubleshooting

### Common Issues

1. **No verification event received**
   - Check if user verification token is valid
   - Verify DB transaction completed successfully
   - Check SSE connection logs

2. **Connection drops frequently**
   - Check proxy timeout settings
   - Verify heartbeat is working
   - Check network stability

3. **Multiple verification events**
   - Ensure cleanup after verification
   - Check for duplicate connections
   - Verify event emission logic

### Debug Commands

Check active connections:
```bash
curl "http://localhost:4100/api/V2/sse/status?email=user@example.com"
```

Monitor logs:
```bash
# Look for SSE-related log entries
tail -f logs/app.log | grep SSE
```
