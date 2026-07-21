# Flutter Frontend Integration Updates

## Overview
This document describes the backend updates that need to be integrated into the Flutter frontend application.

---

## 1. Admin Notification Listening

### What Changed
Admin users are now automatically subscribed to the `admin_notifications` Firebase Cloud Messaging (FCM) topic when they log in via:
- Email/password authentication
- Passkey authentication

### Backend Implementation
- **File Modified**: `services/authService.js`
- **File Modified**: `services/webauthnService.js`
- **Topic Name**: `admin_notifications`

### Flutter Integration Requirements

#### 1.1 Save Admin FCM Token
When an admin logs in, save their FCM token to enable notifications:

```dart
// Call this endpoint after admin login
Future<void> saveAdminFCMToken(String userId, String fcmToken) async {
  final response = await http.put(
    Uri.parse('$baseUrl/Notification/saveFCMToken/$userId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({'fcmToken': fcmToken}),
  );
  
  if (response.statusCode != 200) {
    throw Exception('Failed to save FCM token');
  }
}
```

#### 1.2 Listen for Admin Notifications
Configure Firebase Messaging to listen to the `admin_notifications` topic:

```dart
// In your Firebase messaging service
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  if (message.data['type'] == 'admin_notifications') {
    // Handle admin notification
    // Show notification, update UI, etc.
  }
});

// Subscribe to admin notifications topic
Future<void> subscribeToAdminNotifications() async {
  await FirebaseMessaging.instance.subscribeToTopic('admin_notifications');
}
```

#### 1.3 Notification Types
The backend sends notifications with these data types:
- `maintenance_request` - New maintenance/booking requests from users
- `admin_message` - Direct messages from other admins
- `admin_broadcast` - Broadcast messages to all admins

---

## 2. Issues Management System

### What Changed
New Issues model and API endpoints for tracking user-reported issues.

### Backend Implementation
- **New Model**: `models/issueModel.js`
- **New Service**: `services/issueService.js`
- **New Routes**: `routes/issueRoute.js`
- **Base URL**: `/api/V1/issues`

### Issue Model Structure
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId (ref: User)",
  "platform": "android | ios",
  "app_type": "system | app",
  "description": "String",
  "solved": "Boolean (default: false)",
  "createdAt": "Date",
  "updatedAt": "Date",
  "cairoCreatedAt": "Date",
  "cairoUpdatedAt": "Date"
}
```

### API Endpoints

#### 2.1 Create Issue
- **Endpoint**: `POST /api/V1/issues`
- **Auth**: Required (user or admin)
- **Request Body**:
```json
{
  "user_id": "user_object_id",
  "platform": "android",
  "app_type": "app",
  "description": "Issue description here"
}
```

#### 2.2 Get All Issues (Admin Only)
- **Endpoint**: `GET /api/V1/issues`
- **Auth**: Required (admin only)
- **Response**: Array of all issues with user details

#### 2.3 Get Issue by ID
- **Endpoint**: `GET /api/V1/issues/:id`
- **Auth**: Required (admin only)
- **Response**: Single issue details

#### 2.4 Get Issues by User ID
- **Endpoint**: `GET /api/V1/issues/user/:userId`
- **Auth**: Required (user or admin)
- **Response**: Array of issues for specific user

#### 2.5 Update Issue Status (Admin Only)
- **Endpoint**: `PATCH /api/V1/issues/:id`
- **Auth**: Required (admin only)
- **Request Body**:
```json
{
  "solved": true
}
```

#### 2.6 Delete Issue (Admin Only)
- **Endpoint**: `DELETE /api/V1/issues/:id`
- **Auth**: Required (admin only)

### Flutter Integration Requirements

#### 2.1 Issue Model (Dart)
```dart
class Issue {
  final String id;
  final String userId;
  final String platform;
  final String appType;
  final String description;
  final bool solved;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? cairoCreatedAt;
  final DateTime? cairoUpdatedAt;
  final UserInfo? user; // Populated user details

  Issue({
    required this.id,
    required this.userId,
    required this.platform,
    required this.appType,
    required this.description,
    required this.solved,
    required this.createdAt,
    required this.updatedAt,
    this.cairoCreatedAt,
    this.cairoUpdatedAt,
    this.user,
  });

  factory Issue.fromJson(Map<String, dynamic> json) {
    return Issue(
      id: json['_id'] ?? json['id'],
      userId: json['user_id'],
      platform: json['platform'],
      appType: json['app_type'],
      description: json['description'],
      solved: json['solved'] ?? false,
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      cairoCreatedAt: json['cairoCreatedAt'] != null 
          ? DateTime.parse(json['cairoCreatedAt']) 
          : null,
      cairoUpdatedAt: json['cairoUpdatedAt'] != null 
          ? DateTime.parse(json['cairoUpdatedAt']) 
          : null,
      user: json['user'] != null ? UserInfo.fromJson(json['user']) : null,
    );
  }
}
```

#### 2.2 Create Issue API Call
```dart
Future<Issue> createIssue({
  required String userId,
  required String platform,
  required String appType,
  required String description,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/V1/issues'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({
      'user_id': userId,
      'platform': platform,
      'app_type': appType,
      'description': description,
    }),
  );

  if (response.statusCode == 201) {
    return Issue.fromJson(json.decode(response.body)['data']);
  } else {
    throw Exception('Failed to create issue');
  }
}
```

#### 2.3 Get User Issues API Call
```dart
Future<List<Issue>> getUserIssues(String userId) async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/V1/issues/user/$userId'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['data'] as List)
        .map((issue) => Issue.fromJson(issue))
        .toList();
  } else {
    throw Exception('Failed to get user issues');
  }
}
```

#### 2.4 Get All Issues (Admin) API Call
```dart
Future<List<Issue>> getAllIssues() async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/V1/issues'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    return (data['data'] as List)
        .map((issue) => Issue.fromJson(issue))
        .toList();
  } else {
    throw Exception('Failed to get all issues');
  }
}
```

#### 2.5 Update Issue Status (Admin) API Call
```dart
Future<Issue> updateIssueStatus(String issueId, bool solved) async {
  final response = await http.patch(
    Uri.parse('$baseUrl/api/V1/issues/$issueId'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: json.encode({'solved': solved}),
  );

  if (response.statusCode == 200) {
    return Issue.fromJson(json.decode(response.body)['data']);
  } else {
    throw Exception('Failed to update issue status');
  }
}
```

---

## 3. Platform and App Type Values

### Platform Enum
- `android` - For Android devices
- `ios` - For iOS devices

### App Type Enum
- `system` - System-level issues
- `app` - Application-level issues

---

## 4. Testing Recommendations

### 4.1 Admin Notification Testing
1. Log in as admin via email/password
2. Save FCM token using the save endpoint
3. Trigger a maintenance request from a user
4. Verify admin receives notification

### 4.2 Issues Testing
1. Create an issue as a user
2. Verify issue appears in user's issue list
3. Log in as admin
4. Verify issue appears in admin's all issues list
5. Update issue status to solved
6. Verify status change reflects in UI

---

## 5. Important Notes

- All API endpoints require JWT authentication in the `Authorization` header
- Admin-only endpoints will return 403 for non-admin users
- FCM tokens should be saved after each login to ensure notification delivery
- The `admin_notifications` topic subscription happens automatically on the backend
- Cairo timezone dates are provided in addition to UTC timestamps

---

## 6. Error Handling

Common error responses:
- `400` - Bad request (missing/invalid fields)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found (resource doesn't exist)
- `500` - Server error

Always implement proper error handling in your Flutter app to handle these scenarios gracefully.
