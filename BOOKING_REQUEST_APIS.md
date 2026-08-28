# Booking Request APIs for Frontend

## Overview
This document describes the booking request APIs that the frontend should use to manage maintenance/booking requests.

## Get All Requests (Admin)

### API Endpoint
```
GET /api/V1/booking/allrequests
Authorization: Bearer {jwt_token}
```

### Description
Retrieves all booking requests from all users. This endpoint is intended for admin use to view all maintenance requests in the system.

### Response
```json
{
  "success": true,
  "requests": [
    {
      "_id": "request_id",
      "title": "Request title",
      "description": "Request description",
      "date": "2026-08-31T00:00:00.000Z",
      "status": "pending",
      "user": "user_id",
      "user_name": "User Name",
      "car": "car_id",
      "car_number": "ABC123",
      "createdAt": "2026-08-27T10:00:00.000Z",
      "updatedAt": "2026-08-27T10:00:00.000Z"
    }
  ]
}
```

### Status Values
- `pending` - Request is awaiting admin review
- `accepted` - Request has been accepted
- `rejected` - Request has been rejected
- `cancelled` - Request has been cancelled by the user

### Frontend Implementation
```javascript
const fetchAllRequests = async () => {
  try {
    const response = await fetch('/api/V1/booking/allrequests', {
      headers: { 
        Authorization: `Bearer ${token}` 
      }
    });
    const data = await response.json();
    setRequests(data.requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
  }
};
```

## Reply to Request (Admin)

### API Endpoint
```
PUT /api/V1/booking/admin/:id
Authorization: Bearer {jwt_token}
```

### Description
Allows admin to reply to a booking request by accepting or rejecting it. This will update the request status and send a notification to the user.

### Request Parameters
- **Path Parameter**: `id` - The request ID
- **Body Parameter**: `status` - The reply status

### Request Body
```json
{
  "status": "accepted"
}
```

### Valid Status Values
- `"accepted"` - Accept the booking request
- `"rejected"` - Reject the booking request

### Response
```json
{
  "success": true,
  "message": "Maintenance request accepted successfully",
  "data": {
    "_id": "request_id",
    "title": "Request title",
    "description": "Request description",
    "date": "2026-08-31T00:00:00.000Z",
    "status": "accepted",
    "user": "user_id",
    "user_name": "User Name",
    "car": "car_id",
    "car_number": "ABC123",
    "createdAt": "2026-08-27T10:00:00.000Z",
    "updatedAt": "2026-08-27T13:00:00.000Z"
  },
  "notification": "Notification sent successfully"
}
```

### Error Responses
- `404` - Request not found
- `400` - Request already cancelled

### Frontend Implementation
```javascript
const replyToRequest = async (requestId, status) => {
  try {
    const response = await fetch(`/api/V1/booking/admin/${requestId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    
    if (data.success) {
      // Refresh the requests list
      fetchAllRequests();
      // Show success message
      alert(data.message);
    }
  } catch (error) {
    console.error('Error replying to request:', error);
  }
};
```

### Example Usage
```javascript
// Accept a request
replyToRequest('request_id', 'accepted');

// Reject a request
replyToRequest('request_id', 'rejected');
```

## UI Implementation Suggestions

### Requests List Page
1. Display all requests in a table or card layout
2. Show request details:
   - User name
   - Car number
   - Request date
   - Current status
   - Request description
3. Add action buttons for each request:
   - Accept button (for pending requests)
   - Reject button (for pending requests)
4. Use color coding for status:
   - Green for accepted
   - Red for rejected
   - Yellow for pending
   - Gray for cancelled

### Reply Action
1. Show confirmation dialog before accepting/rejecting
2. Display success/error message after action
3. Refresh the list after successful reply
4. Disable buttons for already processed requests

### Example UI Layout
```
┌─────────────────────────────────────────┐
│ Booking Requests (Admin)                │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ User: John Doe                      │ │
│ │ Car: ABC123                         │ │
│ │ Date: 2026-08-31                    │ │
│ │ Status: Pending                     │ │
│ │                                     │ │
│ │ [Accept] [Reject]                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Important Notes
1. **Authentication**: Always include JWT token in Authorization header
2. **Admin Only**: These endpoints are intended for admin use only
3. **Status Updates**: Only pending requests can be accepted or rejected
4. **Notifications**: Users will receive a notification when their request is replied to
5. **Error Handling**: Handle 401 Unauthorized responses by redirecting to login
6. **Refresh Data**: Always refresh the requests list after replying to a request

## Testing Checklist
- [ ] Can fetch all requests successfully
- [ ] Requests display with correct information
- [ ] Can accept a pending request
- [ ] Can reject a pending request
- [ ] Status updates correctly in the UI
- [ ] Cannot accept/reject already processed requests
- [ ] Error handling works for invalid request IDs
- [ ] Notification is sent to user on reply
