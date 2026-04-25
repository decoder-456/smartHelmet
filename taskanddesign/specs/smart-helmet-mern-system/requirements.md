# Requirements Document

## Introduction

SmartHelmet is a full MERN stack safety system that connects a helmet-mounted ESP32 (via ESP-NOW) to a vehicle-mounted ESP32, which communicates with a Node.js/Express/Socket.io backend. The backend persists data in MongoDB and pushes real-time updates to two React applications: a Driver App and a Family App. The system detects crashes via an MPU6050 accelerometer, triggers engine lock, sends SMS/WhatsApp alerts, and notifies both the driver and linked family members in real time.

The existing backend has a basic Express server with MongoDB (Mongoose), CORS, dotenv, and Twilio for WhatsApp alerts. This spec covers the full upgrade to the architecture described above.

---

## Glossary

- **System**: The complete SmartHelmet MERN stack safety system.
- **Backend**: The Node.js + Express + Socket.io server running on port 5000.
- **Driver_App**: The React application running on port 3000, used by the vehicle driver.
- **Family_App**: The React application running on port 3001, used by linked family members.
- **ESP32_Vehicle**: The ESP32 microcontroller mounted in the vehicle, acting as a WiFi access point at 192.168.4.1.
- **ESP32_Helmet**: The ESP32 microcontroller mounted in the helmet, communicating via ESP-NOW.
- **Poller**: The Backend component that polls ESP32_Vehicle's `/status` endpoint every 1 second.
- **Auth_Service**: The Backend component handling user registration, login, and JWT issuance.
- **Vehicle_Service**: The Backend component handling engine lock/unlock commands and vehicle state.
- **Alert_Service**: The Backend component handling crash alert persistence and acknowledgement.
- **Ride_Service**: The Backend component handling ride session lifecycle.
- **Push_Service**: The Backend component handling web push notification subscriptions.
- **Socket_Server**: The Socket.io layer within the Backend that broadcasts real-time events.
- **JWT**: JSON Web Token used for authenticated API calls.
- **Driver**: A registered user with the `driver` role.
- **Family_Member**: A registered user with the `family` role, linked to a Driver by phone number.
- **Crash_Alert**: A MongoDB document recording a crash event with GPS coordinates and timestamp.
- **Ride_Session**: A MongoDB document recording the start and end of a driving session.
- **Vehicle_State**: A singleton MongoDB document holding the latest polled state from ESP32_Vehicle.
- **MPU6050**: The accelerometer/gyroscope sensor on ESP32_Helmet used for crash detection.
- **ESP-NOW**: The peer-to-peer WiFi protocol used between ESP32_Helmet and ESP32_Vehicle.

---

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a Driver or Family_Member, I want to register and log in with a JWT-secured account, so that I can access role-appropriate features of the system.

#### Acceptance Criteria

1. WHEN a registration request is received with a valid email, password, phone number, and role (`driver` or `family`), THE Auth_Service SHALL create a new user account and return a signed JWT.
2. WHEN a registration request is received with an email that already exists in the database, THE Auth_Service SHALL return an HTTP 409 error with a descriptive message.
3. WHEN a login request is received with valid credentials, THE Auth_Service SHALL return a signed JWT containing the user's ID and role.
4. WHEN a login request is received with invalid credentials, THE Auth_Service SHALL return an HTTP 401 error.
5. WHEN a request is received at `GET /api/auth/me` with a valid JWT in the Authorization header, THE Auth_Service SHALL return the authenticated user's profile excluding the password field.
6. IF a request is received at a protected endpoint without a valid JWT, THEN THE Auth_Service SHALL return an HTTP 401 error.
7. WHEN a Family_Member registers and provides a driver's phone number, THE Auth_Service SHALL store the linked driver's phone number on the Family_Member's account.

---

### Requirement 2: Role-Based Access Control

**User Story:** As a system operator, I want API endpoints to enforce role-based access, so that Drivers and Family_Members can only perform actions appropriate to their role.

#### Acceptance Criteria

1. WHEN a request is received at `POST /api/vehicle/lock` or `POST /api/vehicle/unlock` with a JWT whose role is not `driver`, THE Backend SHALL return an HTTP 403 error.
2. WHEN a request is received at `POST /api/rides/start` or `PATCH /api/rides/:id/end` with a JWT whose role is not `driver`, THE Backend SHALL return an HTTP 403 error.
3. THE Auth_Service SHALL support a `requireRole` middleware that accepts a role parameter and rejects requests from users with a different role.

---

### Requirement 3: ESP32 Vehicle State Polling

**User Story:** As a system operator, I want the backend to continuously poll the ESP32_Vehicle for live telemetry, so that the system always has up-to-date vehicle state.

#### Acceptance Criteria

1. WHILE the Backend is running, THE Poller SHALL send an HTTP GET request to `http://192.168.4.1/status` every 1 second.
2. WHEN the Poller receives a valid response from ESP32_Vehicle, THE Poller SHALL update the Vehicle_State singleton in MongoDB with the fields: `status`, `helmetOn`, `lat`, `lng`, and `timestamp`.
3. WHEN the Poller receives a valid response, THE Socket_Server SHALL emit a `vehicle:update` event to all connected clients with the fields: `status`, `helmetOn`, `lat`, `lng`, and `timestamp`.
4. IF the Poller fails to reach ESP32_Vehicle within 2 seconds, THEN THE Poller SHALL log the error and retry on the next 1-second interval without crashing the Backend.
5. WHEN the polled `status` field equals `CRASH`, THE Alert_Service SHALL create a new Crash_Alert document in MongoDB with `lat`, `lng`, `timestamp`, and `acknowledged: false`.
6. WHEN a new Crash_Alert is created, THE Socket_Server SHALL emit a `crash:alert` event to all connected clients with the fields: `alertId`, `lat`, `lng`, `mapsUrl`, and `timestamp`.

---

### Requirement 4: Vehicle Lock and Unlock Commands

**User Story:** As a Driver, I want to remotely lock and unlock the engine via the app, so that I can control vehicle access.

#### Acceptance Criteria

1. WHEN a Driver sends `POST /api/vehicle/unlock` with a valid JWT, THE Vehicle_Service SHALL forward an unlock command to ESP32_Vehicle and return the updated vehicle state.
2. WHEN a Driver sends `POST /api/vehicle/lock` with a valid JWT, THE Vehicle_Service SHALL forward a lock command to ESP32_Vehicle and return the updated vehicle state.
3. IF ESP32_Vehicle does not respond to a lock or unlock command within 3 seconds, THEN THE Vehicle_Service SHALL return an HTTP 504 error with a descriptive message.
4. WHEN a vehicle command is received via the `vehicle:command` Socket.io event from a Driver client with `command: 'unlock'` or `command: 'lock'`, THE Socket_Server SHALL forward the command to ESP32_Vehicle and emit a `vehicle:update` event with the result.
5. IF a vehicle command via Socket.io fails, THEN THE Socket_Server SHALL emit a `vehicle:error` event to the originating Driver client with a descriptive message.

---

### Requirement 5: Real-Time Socket.io Communication

**User Story:** As a Driver or Family_Member, I want to receive live vehicle updates and crash alerts via WebSocket, so that I am always informed of the vehicle's current state without polling.

#### Acceptance Criteria

1. WHEN a client connects and emits an `identify` event with `{ role, userId }`, THE Socket_Server SHALL associate the socket with the given role and userId.
2. WHEN the Poller produces a new Vehicle_State, THE Socket_Server SHALL emit `vehicle:update` to all identified clients within 1 second of the poll completing.
3. WHEN a Crash_Alert is created, THE Socket_Server SHALL emit `crash:alert` to all identified clients within 1 second of the alert being saved.
4. WHEN a Driver client emits `vehicle:command`, THE Socket_Server SHALL process the command and respond with either `vehicle:update` or `vehicle:error`.
5. WHEN a client disconnects, THE Socket_Server SHALL remove the socket's association from the active client registry.

---

### Requirement 6: Crash Alert History and Acknowledgement

**User Story:** As a Driver or Family_Member, I want to view and acknowledge past crash alerts, so that I can track safety incidents.

#### Acceptance Criteria

1. WHEN a request is received at `GET /api/alerts` with a valid JWT, THE Alert_Service SHALL return the 50 most recent Crash_Alert documents sorted by timestamp descending.
2. WHEN a request is received at `PATCH /api/alerts/:id/acknowledge` with a valid JWT, THE Alert_Service SHALL set the `acknowledged` field of the specified Crash_Alert to `true` and return the updated document.
3. IF a request is received at `PATCH /api/alerts/:id/acknowledge` with an ID that does not exist, THEN THE Alert_Service SHALL return an HTTP 404 error.

---

### Requirement 7: Ride Session Management

**User Story:** As a Driver, I want to start and end ride sessions, so that I can track my driving history.

#### Acceptance Criteria

1. WHEN a Driver sends `POST /api/rides/start` with a valid JWT, THE Ride_Service SHALL create a new Ride_Session document with `startTime`, `driverId`, and `status: 'active'`, and return the created document.
2. WHEN a Driver sends `PATCH /api/rides/:id/end` with a valid JWT, THE Ride_Service SHALL update the specified Ride_Session with `endTime` and `status: 'completed'`, and return the updated document.
3. IF a Driver sends `PATCH /api/rides/:id/end` for a Ride_Session that does not belong to the authenticated Driver, THEN THE Ride_Service SHALL return an HTTP 403 error.
4. WHEN a request is received at `GET /api/rides` with a valid Driver JWT, THE Ride_Service SHALL return all Ride_Session documents belonging to the authenticated Driver, sorted by startTime descending.

---

### Requirement 8: Web Push Notification Subscriptions

**User Story:** As a Family_Member, I want to receive browser push notifications for crash alerts, so that I am notified even when the app is not in the foreground.

#### Acceptance Criteria

1. WHEN a Family_Member sends a valid push subscription object to `POST /api/push/subscribe` with a valid JWT, THE Push_Service SHALL store the subscription associated with the user's account.
2. WHEN a Crash_Alert is created, THE Push_Service SHALL send a web push notification to all stored subscriptions belonging to Family_Members linked to the affected Driver.
3. IF a push notification delivery fails for a subscription, THEN THE Push_Service SHALL remove the invalid subscription from the database and log the failure.

---

### Requirement 9: Driver App — Authentication and Dashboard

**User Story:** As a Driver, I want a React app where I can log in, view live vehicle status, and control the engine lock, so that I can manage my vehicle from my phone.

#### Acceptance Criteria

1. THE Driver_App SHALL provide a login and registration page that stores the JWT in localStorage upon successful authentication.
2. WHEN the Driver_App loads with a valid stored JWT, THE Driver_App SHALL connect to the Backend Socket_Server and emit an `identify` event with the Driver's role and userId.
3. WHEN a `vehicle:update` event is received, THE Driver_App SHALL update the status ring and GPS display within 500ms.
4. WHEN the Driver taps the lock button, THE Driver_App SHALL emit a `vehicle:command` event with `command: 'lock'`.
5. WHEN the Driver taps the unlock button, THE Driver_App SHALL emit a `vehicle:command` event with `command: 'unlock'`.
6. WHEN a `crash:alert` event is received, THE Driver_App SHALL display a full-screen crash overlay with vibration and alarm sound.
7. IF the JWT stored in localStorage is expired or invalid, THEN THE Driver_App SHALL redirect the user to the login page.

---

### Requirement 10: Family App — Authentication and Live Monitoring

**User Story:** As a Family_Member, I want a React app where I can log in, view the driver's live status, and receive crash alerts with emergency actions, so that I can respond quickly in an emergency.

#### Acceptance Criteria

1. THE Family_App SHALL provide a login and registration page that includes a field for the linked driver's phone number and stores the JWT in localStorage upon successful authentication.
2. WHEN the Family_App loads with a valid stored JWT, THE Family_App SHALL connect to the Backend Socket_Server and emit an `identify` event with the Family_Member's role and userId.
3. WHEN a `vehicle:update` event is received, THE Family_App SHALL update the live status display within 500ms.
4. WHEN a `crash:alert` event is received, THE Family_App SHALL display a crash modal with the GPS map link, trigger vibration in an SOS pattern (`[1000, 500, 1000, 500, 1000]` ms), play an alarm sound, and send a browser push notification.
5. WHERE the device browser supports the Web Notifications API, THE Family_App SHALL request notification permission on first load after login.
6. THE Family_App SHALL display a button within the crash modal that initiates a call to emergency services (112).
7. WHEN the Family_Member clicks the acknowledge button in the crash modal, THE Family_App SHALL call `PATCH /api/alerts/:id/acknowledge` and dismiss the modal.
8. THE Family_App SHALL display the last 50 crash alerts in a history list, showing timestamp, GPS link, and acknowledgement status.

---

### Requirement 11: Crash Detection and Automated Response

**User Story:** As a system operator, I want the system to automatically respond to a detected crash, so that emergency actions are taken without requiring manual intervention.

#### Acceptance Criteria

1. WHEN ESP32_Helmet detects an acceleration magnitude exceeding 20 m/s² on the MPU6050, THE ESP32_Helmet SHALL set `crashDetected = true` and transmit it to ESP32_Vehicle via ESP-NOW.
2. WHEN ESP32_Vehicle receives `crashDetected = true` from ESP32_Helmet, THE ESP32_Vehicle SHALL set its internal `status` to `CRASH`, cut the engine relay, and send an SMS alert.
3. WHEN the Poller reads `status: CRASH` from ESP32_Vehicle, THE Backend SHALL trigger the full crash sequence: persist a Crash_Alert, emit `crash:alert` via Socket.io, and trigger web push notifications.
4. WHEN a Crash_Alert is created, THE Backend SHALL send a WhatsApp message via Twilio to the configured emergency contact number with the GPS coordinates and a Google Maps link.

---

### Requirement 12: ESP32 Vehicle Firmware CORS and API Compatibility

**User Story:** As a backend developer, I want the ESP32_Vehicle firmware to expose CORS-compliant HTTP endpoints, so that the Backend can poll and command it without cross-origin errors.

#### Acceptance Criteria

1. THE ESP32_Vehicle firmware SHALL expose a `GET /status` endpoint returning a JSON object with fields: `status`, `helmetOn`, `lat`, `lng`, and `timestamp`.
2. THE ESP32_Vehicle firmware SHALL expose a `POST /lock` endpoint that activates the engine relay lock and returns `{ "result": "locked" }`.
3. THE ESP32_Vehicle firmware SHALL expose a `POST /unlock` endpoint that deactivates the engine relay lock and returns `{ "result": "unlocked" }`.
4. THE ESP32_Vehicle firmware SHALL include CORS headers (`Access-Control-Allow-Origin: *`) on all HTTP responses.
5. WHEN ESP32_Vehicle receives a `crashDetected = true` message via ESP-NOW, THE ESP32_Vehicle firmware SHALL update the `/status` response to include `"status": "CRASH"` within 500ms.
