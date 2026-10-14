# CivicPulse — Smart Civic Grievance & Constituency Operations Platform

CivicPulse is a mobile application designed to help elected representatives, administrative offices, and field personnel manage civic grievances, citizen appointments, constituency activities, and day-to-day operations through a centralized platform.

The application provides tools for grievance tracking, geographic visualization, personnel management, public appointments, budget monitoring, event coordination, and citizen complaint lookup.

## Key Features

### 1. Grievance Management
- Register and manage citizen complaints.
- Track grievance statuses, including Pending, In Progress, and Resolved.
- Manage complaint priorities and location information.
- Support photo evidence and complaint details where configured.
- Export grievance records to supported document formats.

### 2. Geographic Analytics
- Display civic issues on interactive maps.
- Visualize complaint locations using map markers and clustering.
- Identify areas with a high concentration of reported issues.
- Support geographic monitoring of constituency activities.

### 3. User and Personnel Management
- Manage administrative users and field personnel.
- Support role-based access control.
- View and update user status where permitted.
- Display profile images or initials-based avatars.

### 4. Ward Budget and Development Funds
- Manage ward-level development fund information.
- Track sanctioned allocations and expenditure records.
- Organize funding by source and development category.
- Display budget summaries and allocation progress.

### 5. Office Expense Management
- Maintain office expenditure records.
- Organize expenses by category.
- Review expense summaries and supporting documents where available.

### 6. Public Appointments
- Manage citizen appointments and public meetings.
- Maintain appointment schedules and confirmation statuses.
- Organize citizen visits and delegation records.

### 7. Events and Activities
- Create and manage constituency events.
- Maintain event schedules, details, and related information.
- Coordinate public programs and field activities.

### 8. Contact Directory and Communication
- Maintain categorized contact records.
- Organize administrative, media, and other relevant contacts.
- Provide communication features supported by the configured backend.

### 9. Public Grievance Tracking
- Provide a public-facing interface for checking grievance status.
- Allow citizens to access supported tracking functionality without requiring a full administrative account.

### 10. Supporting Modules
Depending on the configured application version, additional modules may include asset management, file management, social media scheduling, live tracking, notifications, and data exports.

## Technology Stack

| Component | Technology |
|---|---|
| Mobile framework | React Native |
| Development platform | Expo |
| Programming language | JavaScript |
| Navigation | React Navigation or project-configured navigation |
| API communication | Axios |
| Maps | Leaflet, OpenStreetMap, and WebView integration |
| Secure local storage | Expo SecureStore |
| Location services | Expo Location |
| Image selection | Expo Image Picker |
| Document selection | Expo Document Picker |
| PDF generation | Expo Print |
| File sharing | Expo Sharing |
| Backend | Configured REST API |
| Version control | Git and GitHub |
| Android builds | Expo Application Services (EAS) |

*The technology list should be checked against the current project dependencies before release.*

## Project Structure

```text
civicpulse-mobile-app/
├── assets/
│   └── App icons, images, and branding
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   └── ui/
│   ├── config/
│   │   └── env.js
│   ├── navigation/
│   ├── screens/
│   │   ├── admin/
│   │   ├── appointments/
│   │   ├── assets/
│   │   ├── auth/
│   │   ├── budget/
│   │   ├── complaints/
│   │   ├── contacts/
│   │   ├── dashboard/
│   │   ├── events/
│   │   ├── files/
│   │   └── social/
│   ├── services/
│   │   └── api.js
│   └── utils/
│       ├── fileExport.js
│       └── soundHelper.js
├── app.json
├── eas.json
├── package.json
└── README.md
```

*This structure is illustrative. Keep only directories and files that actually exist in your repository.*

## Prerequisites

Before running the application, install:

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)
- npm, included with Node.js
- [Expo Go](https://expo.dev/go/) for compatible development workflows on a physical device
- An Android emulator or other supported development environment, if required

Use the Node.js version supported by the project's Expo SDK and dependencies.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Pravin-junne/civicpulse-mobile-app.git
cd civicpulse-mobile-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the backend

Open `src/config/env.js` and review the application's API configuration.

Configure the correct backend URL for your environment. For local development, use your computer's LAN IP address when connecting from a physical phone.

Example configuration:

```javascript
export const USE_DEPLOYED_BACKEND = true;

export const PROD_SERVER_URL =
  'https://dev.api.office.kunaltilak.com';

// Replace with your development computer's LAN IP.
export const DEV_MACHINE_IP = '192.168.0.100';
export const DEV_PORT = 5000;
```

**Important:** This is an example based on the proposed configuration. Match the variable names and values to the actual `env.js` implementation. Use HTTPS for deployed environments, and never commit API credentials, private keys, or other secrets to GitHub.

### 4. Start the development server

```bash
npx expo start
```

Available launch options depend on your installed Expo SDK and project configuration.

- **Physical device:** Scan the QR code using the appropriate Expo development workflow.
- **Android emulator:** Press `a` in the Expo terminal if the Android development environment is configured.
- **Web:** Press `w` if the project supports web and its required dependencies are installed.

If a native module is incompatible with Expo Go, use a development build configured for that module.

## Building an Android APK

If the project is configured for EAS Build, you can generate an installable Android APK.

### 1. Sign in to Expo

```bash
npx eas-cli login
```

### 2. Configure EAS Build

If the project has not been configured previously, run:

```bash
npx eas-cli build:configure
```

Review `eas.json` and ensure that a build profile uses APK output. For example:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

Merge this configuration with the existing `eas.json` rather than overwriting other project settings.

### 3. Build the APK

```bash
npx eas-cli build -p android --profile preview
```

When the build completes, use the build URL provided by EAS to download the APK and install it on a compatible Android device.

For a production release, review app signing, application permissions, backend security, and release configuration before distributing the application.

## Security Considerations

- **Authentication:** Validate authentication and authorization on the backend.
- **Role-based access:** Enforce permissions on API endpoints, not only in the user interface.
- **Secure storage:** Use platform-appropriate secure storage for sensitive locally stored credentials.
- **Network security:** Use HTTPS for production API communication.
- **Secret management:** Keep private keys, passwords, tokens, and sensitive environment variables out of source control.
- **Data protection:** Protect citizen information, contact details, location data, and uploaded documents.
- **Input validation:** Validate requests and uploaded files on the backend.
- **Session management:** Handle token expiration, logout, and unauthorized API responses securely.
- **Release testing:** Verify permissions, error handling, and access controls before publishing.

## Development Workflow

A typical development workflow is:

1. Clone the repository and install dependencies.
2. Configure the development backend.
3. Run the application locally.
4. Test individual screens and API integrations.
5. Run integration and regression tests where available.
6. Build and validate the Android APK.
7. Review security and functionality before distribution.

## Troubleshooting

**Application cannot connect to the backend**
- Verify the API base URL.
- Ensure the backend server is running and reachable.
- For local testing, confirm that the phone and development computer can communicate over the network.
- Check firewall settings and backend logs.

**Expo dependencies are incompatible**
- Run `npx expo-doctor`.
- Review SDK compatibility and install compatible packages using `npx expo install` where appropriate.

**Android APK build fails**
- Review the EAS build logs.
- Verify the Expo configuration, Android package identifier, native dependencies, and build profile.

## License

No license has been specified in this README. Add a `LICENSE` file and update this section once the project's distribution and usage terms have been decided.

## Project Information

**Project:** CivicPulse Mobile App  
**Repository:** [civicpulse-mobile-app](https://github.com/Pravin-junne/civicpulse-mobile-app)  
**Platform:** Android and other platforms supported by the project configuration  
**Purpose:** Civic grievance management and constituency operations

---

*Disclaimer: Features and integrations depend on the deployed backend, user permissions, application version, and environment configuration. This README describes the intended functionality and setup workflow; it does not independently certify production readiness.*
