# Implementation Plan: SmartHelmet MERN System

## Overview

This implementation plan converts the SmartHelmet design into a series of incremental coding tasks. The system will be built in layers: backend models and middleware first, then services and routes, followed by Socket.io integration, frontend applications, and finally ESP32 firmware updates and integration testing.

The existing backend has basic Express, MongoDB, CORS, dotenv, and Twilio setup. We'll extend it to include authentication, real-time communication, vehicle control, and two React applications.

## Tasks

- [x] 1. Set up backend project structure and dependencies
  - Install required npm packages: `jsonwebtoken`, `bcryptjs`, `socket.io`, `axios`, `web-push`
  - Create directory structure: `models/`, `routes/`, `services/`, `middleware/`, `socket/`, `utils/`
  - Update `.env` with JWT_SECRET, VAPID keys for web push
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implement MongoDB data models
  - [x] 2.1 Create User model with authentication methods
    - Define User schema with email, password, phone, role, linkedDriverPhone fields
    - Add pre-save hook for password hashing with bcrypt
    - Add comparePassword method for login validation
    - _Requirements: 1.1, 1.2, 1.7_
  
  - [x] 2.2 Create VehicleState singleton model
    - Define VehicleState schema with status, helmetOn, lat, lng, timestamp
    - Implement singleton pattern with `_id: 'singleton'`
    - _Requirements: 3.2_
  
  - [x] 2.3 Create Alert model
    - Define Alert schema with lat, lng, timestamp, acknowledged, acknowledgedAt, acknowledgedBy
    - Add indexes for timestamp and acknowledged fields
    - Add virtual field for mapsUrl computed property
    - _Requirements: 3.5, 6.1, 6.2_
  
  - [x] 2.4 Create Ride model
    - Define Ride schema with driverId, startTime, endTime, status
    - Add indexes for driverId and startTime
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [x] 2.5 Create PushSubscription model
    - Define PushSubscription schema with userId, endpoint, keys (p256dh, auth)
    - Add index for userId
    - _Requirements: 8.1_

- [ ] 3. Implement authentication middleware and services
  - [x] 3.1 Create JWT authentication middleware
    - Implement `authenticate` middleware to verify JWT and attach user to request
    - Handle invalid/expired tokens with 401 errors
    - _Requirements: 1.5, 1.6_
  
  - [x] 3.2 Create role-based access control middleware
    - Implement `requireRole(role)` middleware to enforce role restrictions
    - Return 403 error for unauthorized roles
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 3.3 Create Auth Service
    - Implement `register` function with user creation and JWT generation
    - Implement `login` function with credential validation and JWT generation
    - Handle duplicate email errors (409) and invalid credentials (401)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_
  
  - [ ]* 3.4 Write unit tests for authentication
    - Test registration with valid/invalid data
    - Test login with valid/invalid credentials
    - Test JWT middleware with valid/expired/missing tokens
    - Test requireRole middleware with different roles

- [ ] 4. Implement authentication routes
  - [x] 4.1 Create auth routes
    - Implement `POST /api/auth/register` endpoint
    - Implement `POST /api/auth/login` endpoint
    - Implement `GET /api/auth/me` endpoint with authentication
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  
  - [ ]* 4.2 Write integration tests for auth routes
    - Test full registration flow with MongoDB
    - Test login flow and JWT validation
    - Test protected endpoint access

- [ ] 5. Checkpoint - Ensure authentication works
  - Test registration and login via Postman or curl
  - Verify JWT is returned and can access protected routes
  - Ensure all tests pass, ask the user if questions arise

- [ ] 6. Implement Vehicle Service and routes
  - [x] 6.1 Create Vehicle Service
    - Implement `lockEngine()` function to POST to ESP32 `/lock` endpoint
    - Implement `unlockEngine()` function to POST to ESP32 `/unlock` endpoint
    - Implement `getVehicleState()` function to fetch from MongoDB
    - Add 3-second timeout and error handling for ESP32 commands
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 6.2 Create vehicle routes
    - Implement `POST /api/vehicle/lock` endpoint (driver only)
    - Implement `POST /api/vehicle/unlock` endpoint (driver only)
    - Implement `GET /api/vehicle/state` endpoint (authenticated)
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 6.3 Write unit tests for Vehicle Service
    - Test lock/unlock with mocked axios
    - Test timeout handling
    - Test error responses

- [ ] 7. Implement Alert Service and routes
  - [x] 7.1 Create Alert Service
    - Implement `createCrashAlert(lat, lng, timestamp)` function
    - Implement `getAlerts(limit)` function with sorting
    - Implement `acknowledgeAlert(alertId, userId)` function
    - Integrate Twilio WhatsApp message sending on alert creation
    - _Requirements: 3.5, 6.1, 6.2, 11.4_
  
  - [x] 7.2 Create alert routes
    - Implement `GET /api/alerts` endpoint (authenticated)
    - Implement `PATCH /api/alerts/:id/acknowledge` endpoint (authenticated)
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 7.3 Write unit tests for Alert Service
    - Test alert creation with valid data
    - Test alert acknowledgement
    - Test Twilio integration with mocked client

- [ ] 8. Implement Ride Service and routes
  - [x] 8.1 Create Ride Service
    - Implement `startRide(driverId)` function
    - Implement `endRide(rideId, driverId)` function with ownership validation
    - Implement `getRides(driverId)` function with sorting
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 8.2 Create ride routes
    - Implement `POST /api/rides/start` endpoint (driver only)
    - Implement `PATCH /api/rides/:id/end` endpoint (driver only)
    - Implement `GET /api/rides` endpoint (driver only)
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ]* 8.3 Write unit tests for Ride Service
    - Test ride start/end flow
    - Test ownership validation
    - Test error cases (ending non-existent ride, wrong owner)

- [ ] 9. Implement Push Service and routes
  - [x] 9.1 Create Push Service
    - Configure web-push with VAPID keys from environment
    - Implement `subscribe(userId, subscription)` function
    - Implement `sendCrashNotification(alertId, lat, lng)` function
    - Implement `removeInvalidSubscription(subscriptionId)` function
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 9.2 Create push routes
    - Implement `POST /api/push/subscribe` endpoint (family only)
    - _Requirements: 8.1_
  
  - [ ]* 9.3 Write unit tests for Push Service
    - Test subscription storage
    - Test push notification sending with mocked web-push
    - Test invalid subscription cleanup

- [ ] 10. Checkpoint - Ensure all services and routes work
  - Test all endpoints via Postman or curl
  - Verify MongoDB operations (create, read, update)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 11. Implement ESP32 Poller Service
  - [x] 11.1 Create Poller Service
    - Implement polling loop with 1-second interval
    - Make HTTP GET to `http://192.168.4.1/status` with 2-second timeout
    - Update VehicleState singleton in MongoDB on success
    - Detect crash status and trigger Alert Service
    - Implement error handling without crashing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.3_
  
  - [x] 11.2 Integrate Poller with server startup
    - Call `startPoller()` in server.js after MongoDB connection
    - Add graceful shutdown to stop poller on server exit
    - _Requirements: 3.1_
  
  - [ ]* 11.3 Write unit tests for Poller
    - Test polling cycle with mocked axios
    - Test crash detection flow
    - Test error handling and retry logic

- [ ] 12. Implement Socket.io server
  - [x] 12.1 Set up Socket.io server
    - Initialize Socket.io attached to HTTP server
    - Configure CORS for Socket.io to allow Driver_App and Family_App origins
    - _Requirements: 5.1_
  
  - [x] 12.2 Implement Socket.io event handlers
    - Implement `identify` event handler to associate socket with userId and role
    - Implement `vehicle:command` event handler for lock/unlock (driver only)
    - Implement `disconnect` event handler for cleanup
    - _Requirements: 5.1, 5.4, 5.5_
  
  - [x] 12.3 Implement Socket.io broadcast functions
    - Create `broadcastVehicleUpdate(state)` function to emit `vehicle:update`
    - Create `broadcastCrashAlert(alert)` function to emit `crash:alert`
    - Integrate broadcasts into Poller and Alert Service
    - _Requirements: 3.3, 3.6, 5.2, 5.3_
  
  - [ ]* 12.4 Write integration tests for Socket.io
    - Test client connection and identification
    - Test vehicle command handling
    - Test broadcast to multiple clients

- [x] 13. Implement global error handler
  - Create error handler middleware for Express
  - Handle ValidationError, JsonWebTokenError, TokenExpiredError, MongoDB duplicate key errors
  - Return appropriate HTTP status codes and error messages
  - _Requirements: 1.2, 1.4, 1.6, 4.3, 6.3, 7.3_

- [x] 14. Update server.js to wire all components
  - Connect to MongoDB using MONGO_URI from .env
  - Mount all route handlers: `/api/auth`, `/api/vehicle`, `/api/alerts`, `/api/rides`, `/api/push`
  - Initialize Socket.io server
  - Start Poller service
  - Add global error handler middleware
  - Start HTTP server on port 5000
  - _Requirements: All backend requirements_

- [x] 15. Checkpoint - Ensure backend is fully functional
  - Test all REST endpoints
  - Test Socket.io connection and events
  - Verify Poller is running and updating vehicle state
  - Ensure all tests pass, ask the user if questions arise

- [x] 16. Set up Driver React app project
  - Create React app in `driver-app/` directory using Vite or Create React App
  - Install dependencies: `socket.io-client`, `axios`, `react-router-dom`, `leaflet` or Google Maps
  - Configure proxy or environment variable for backend API URL (http://localhost:5000)
  - _Requirements: 9.1_

- [x] 17. Implement Driver App authentication context and pages
  - [x] 17.1 Create AuthContext with JWT management
    - Implement login, logout, register functions
    - Store JWT in localStorage
    - Provide authenticated user state
    - _Requirements: 9.1, 9.7_
  
  - [x] 17.2 Create LoginPage component
    - Form with email and password fields
    - Call AuthContext login function
    - Redirect to dashboard on success
    - _Requirements: 9.1_
  
  - [x] 17.3 Create RegisterPage component
    - Form with email, password, phone, role fields
    - Call AuthContext register function
    - Redirect to dashboard on success
    - _Requirements: 9.1_
  
  - [ ]* 17.4 Write unit tests for auth pages
    - Test form submission
    - Test error handling
    - Test redirect on success

- [x] 18. Implement Driver App Socket.io integration
  - [x] 18.1 Create SocketContext
    - Initialize socket.io-client connection to backend
    - Emit `identify` event with driver role and userId on connection
    - Provide socket instance to components
    - Handle connection errors
    - _Requirements: 9.2_
  
  - [x] 18.2 Create useVehicleState hook
    - Subscribe to `vehicle:update` events
    - Maintain vehicle state in React state
    - Subscribe to `crash:alert` events
    - _Requirements: 9.3, 9.6_
  
  - [ ]* 18.3 Write unit tests for Socket hooks
    - Test socket connection
    - Test event subscription
    - Test state updates

- [x] 19. Implement Driver App dashboard components
  - [x] 19.1 Create DashboardPage component
    - Layout with StatusRing, GPSDisplay, ControlButtons, RideControls
    - Use SocketContext and useVehicleState hook
    - Show CrashOverlay when crash alert received
    - _Requirements: 9.2, 9.3, 9.6_
  
  - [x] 19.2 Create StatusRing component
    - Display circular status indicator with color coding (Green: IDLE, Blue: DRIVING, Red: CRASH)
    - Animate transitions with CSS
    - _Requirements: 9.3_
  
  - [x] 19.3 Create GPSDisplay component
    - Display lat/lng coordinates
    - Show helmet status (on/off)
    - _Requirements: 9.3_
  
  - [x] 19.4 Create ControlButtons component
    - Lock button emits `vehicle:command` with `command: 'lock'`
    - Unlock button emits `vehicle:command` with `command: 'unlock'`
    - Disable buttons during command execution
    - Show loading spinner
    - _Requirements: 9.4, 9.5_
  
  - [x] 19.5 Create RideControls component
    - Start Ride button calls `POST /api/rides/start`
    - End Ride button calls `PATCH /api/rides/:id/end`
    - Display current ride status
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 19.6 Write unit tests for dashboard components
    - Test StatusRing color changes
    - Test ControlButtons emit correct events
    - Test RideControls API calls

- [x] 20. Implement Driver App crash overlay
  - [x] 20.1 Create CrashOverlay component
    - Full-screen red overlay with crash icon
    - Display GPS coordinates and "Open Maps" button
    - Play alarm sound (looping)
    - Trigger vibration pattern: `[1000, 500, 1000, 500, 1000]`
    - Acknowledge button calls `PATCH /api/alerts/:id/acknowledge`
    - _Requirements: 9.6_
  
  - [ ]* 20.2 Write unit tests for CrashOverlay
    - Test display of crash data
    - Test acknowledge button
    - Test sound and vibration triggers

- [x] 21. Implement Driver App routing and protected routes
  - Set up React Router with routes: `/login`, `/register`, `/dashboard`
  - Implement ProtectedRoute component to check JWT validity
  - Redirect to login if JWT is expired or missing
  - _Requirements: 9.7_

- [ ] 22. Checkpoint - Ensure Driver App works end-to-end
  - Test registration and login flow
  - Test Socket.io connection and real-time updates
  - Test vehicle lock/unlock commands
  - Test ride start/end
  - Test crash alert display
  - Ensure all tests pass, ask the user if questions arise

- [x] 23. Set up Family React app project
  - Create React app in `family-app/` directory using Vite or Create React App
  - Install dependencies: `socket.io-client`, `axios`, `react-router-dom`, `leaflet` or Google Maps
  - Configure proxy or environment variable for backend API URL (http://localhost:5000)
  - _Requirements: 10.1_

- [x] 24. Implement Family App authentication context and pages
  - [x] 24.1 Create AuthContext with JWT management
    - Implement login, logout, register functions
    - Store JWT in localStorage
    - Provide authenticated user state
    - _Requirements: 10.1_
  
  - [x] 24.2 Create LoginPage component
    - Form with email and password fields
    - Call AuthContext login function
    - Redirect to monitoring page on success
    - _Requirements: 10.1_
  
  - [x] 24.3 Create RegisterPage component
    - Form with email, password, phone, role, linkedDriverPhone fields
    - Call AuthContext register function
    - Redirect to monitoring page on success
    - _Requirements: 10.1_
  
  - [ ]* 24.4 Write unit tests for auth pages
    - Test form submission with linkedDriverPhone field
    - Test error handling
    - Test redirect on success

- [x] 25. Implement Family App Socket.io integration
  - [x] 25.1 Create SocketContext
    - Initialize socket.io-client connection to backend
    - Emit `identify` event with family role and userId on connection
    - Provide socket instance to components
    - Handle connection errors
    - _Requirements: 10.2_
  
  - [x] 25.2 Create useVehicleState hook
    - Subscribe to `vehicle:update` events
    - Maintain vehicle state in React state
    - Subscribe to `crash:alert` events
    - _Requirements: 10.3, 10.4_
  
  - [ ]* 25.3 Write unit tests for Socket hooks
    - Test socket connection
    - Test event subscription
    - Test state updates

- [ ] 26. Implement Family App web push notifications
  - [ ] 26.1 Create service worker for push notifications
    - Register service worker in public/sw.js
    - Handle push event and display notification
    - _Requirements: 10.4_
  
  - [ ] 26.2 Create useNotifications hook
    - Request notification permission on first load after login
    - Generate push subscription using service worker
    - Send subscription to backend via `POST /api/push/subscribe`
    - _Requirements: 10.5_
  
  - [ ]* 26.3 Write unit tests for notification hooks
    - Test permission request
    - Test subscription generation
    - Test API call to save subscription

- [ ] 27. Implement Family App monitoring page components
  - [ ] 27.1 Create MonitoringPage component
    - Layout with LiveStatus and AlertHistory
    - Use SocketContext and useVehicleState hook
    - Show CrashModal when crash alert received
    - Request notification permission on mount
    - _Requirements: 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 27.2 Create LiveStatus component
    - Display driver's current status (IDLE/DRIVING/CRASH)
    - Show helmet status (on/off)
    - Display GPS coordinates
    - Update in real-time via `vehicle:update` events
    - _Requirements: 10.3_
  
  - [ ] 27.3 Create AlertHistory component
    - Fetch alerts from `GET /api/alerts` on mount
    - Display list with timestamp, GPS link, acknowledgement status
    - Allow acknowledging unacknowledged alerts
    - _Requirements: 10.8_
  
  - [ ]* 27.4 Write unit tests for monitoring components
    - Test LiveStatus updates
    - Test AlertHistory display and acknowledgement

- [ ] 28. Implement Family App crash modal
  - [ ] 28.1 Create CrashModal component
    - Modal overlay with crash details
    - Display GPS coordinates and "Open Maps" link
    - EmergencyButton to call 112
    - Acknowledge button calls `PATCH /api/alerts/:id/acknowledge`
    - Play alarm sound (looping)
    - Trigger SOS vibration: `[1000, 500, 1000, 500, 1000]`
    - Send browser push notification
    - _Requirements: 10.4, 10.6, 10.7_
  
  - [ ] 28.2 Create EmergencyButton component
    - Button that initiates call to emergency services (112)
    - Use `tel:112` link for mobile devices
    - _Requirements: 10.6_
  
  - [ ]* 28.3 Write unit tests for CrashModal
    - Test display of crash data
    - Test acknowledge button
    - Test emergency call button
    - Test sound and vibration triggers

- [x] 29. Implement Family App routing and protected routes
  - Set up React Router with routes: `/login`, `/register`, `/monitoring`
  - Implement ProtectedRoute component to check JWT validity
  - Redirect to login if JWT is expired or missing
  - _Requirements: 10.1_

- [ ] 30. Checkpoint - Ensure Family App works end-to-end
  - Test registration and login flow with linkedDriverPhone
  - Test Socket.io connection and real-time updates
  - Test notification permission request
  - Test crash alert display with modal
  - Test alert history and acknowledgement
  - Ensure all tests pass, ask the user if questions arise

- [ ] 31. Update ESP32 Vehicle firmware for CORS and API compatibility
  - [ ] 31.1 Add CORS headers to ESP32 HTTP responses
    - Add `Access-Control-Allow-Origin: *` header to all responses
    - Add `Access-Control-Allow-Methods: GET, POST, OPTIONS` header
    - Handle OPTIONS preflight requests
    - _Requirements: 12.4_
  
  - [ ] 31.2 Verify ESP32 endpoints match backend expectations
    - Ensure `GET /status` returns JSON with `status`, `helmetOn`, `lat`, `lng`, `timestamp`
    - Ensure `POST /lock` returns `{ "result": "locked" }`
    - Ensure `POST /unlock` returns `{ "result": "unlocked" }`
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ] 31.3 Implement crash status update on ESP-NOW message
    - When `crashDetected = true` received via ESP-NOW, set `status = "CRASH"`
    - Update `/status` response within 500ms
    - _Requirements: 11.2, 12.5_

- [ ] 32. Integration testing and end-to-end validation
  - [ ]* 32.1 Test full crash detection flow
    - Simulate ESP32 crash status
    - Verify backend creates alert
    - Verify Socket.io broadcasts to both apps
    - Verify Twilio WhatsApp message sent
    - Verify web push notification sent
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 32.2 Test vehicle control flow
    - Driver locks vehicle via app
    - Verify backend sends command to ESP32
    - Verify state update broadcast
    - Verify unlock flow
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  
  - [ ]* 32.3 Test ride session flow
    - Driver starts ride
    - Driver ends ride
    - Verify ride history displays correctly
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [ ]* 32.4 Test multi-user Socket.io broadcasting
    - Connect driver and family clients simultaneously
    - Verify both receive vehicle updates
    - Verify both receive crash alerts
    - _Requirements: 5.2, 5.3_

- [ ] 33. Environment configuration and documentation
  - [ ] 33.1 Update .env.example file
    - Document all required environment variables
    - Include MONGO_URI, JWT_SECRET, Twilio credentials, VAPID keys
    - _Requirements: All_
  
  - [ ] 33.2 Create README.md with setup instructions
    - Document installation steps for backend and both frontend apps
    - Document ESP32 setup and configuration
    - Document how to run the system locally
    - _Requirements: All_
  
  - [ ] 33.3 Add npm scripts for development
    - Add script to run backend: `npm run dev`
    - Add script to run Driver App: `npm run dev:driver`
    - Add script to run Family App: `npm run dev:family`
    - Add script to run all tests: `npm test`

- [ ] 34. Final checkpoint - Full system validation
  - Run all three components simultaneously (backend, Driver App, Family App)
  - Test complete user flows: registration, login, vehicle control, crash detection
  - Verify real-time updates work across all clients
  - Verify all alerts and notifications work
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The implementation follows a bottom-up approach: models → services → routes → Socket.io → frontend
- All code should be written in JavaScript (Node.js for backend, React for frontend)
- MongoDB connection and basic Express setup already exist in backend/server.js
- Twilio credentials are already configured in .env for WhatsApp alerts
