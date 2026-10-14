import { NativeModules, Platform } from 'react-native';

/**
 * Set USE_DEPLOYED_BACKEND = true to connect to the deployed cloud server (default: true).
 * Set USE_DEPLOYED_BACKEND = false to connect to your local PC backend on DEV_MACHINE_IP:DEV_PORT.
 */
export const USE_DEPLOYED_BACKEND = true;
export const PROD_SERVER_URL = 'https://dev.api.office.kunaltilak.com';

/**
 * Your development machine's local Wi-Fi LAN IP address.
 * Used only when USE_DEPLOYED_BACKEND is set to false.
 */
export const DEV_MACHINE_IP = '192.168.0.245';
export const DEV_PORT = 5000;

/**
 * Dynamically determines the backend API URL.
 * Automatically handles physical Android/iOS test phones on Wi-Fi,
 * Android Studio emulators, iOS simulators, and production builds.
 */
export const getDynamicHost = () => {
  // 1. If configured to use deployed backend or running in production release build
  if (USE_DEPLOYED_BACKEND || !__DEV__) {
    return PROD_SERVER_URL;
  }

  // 2. Web browser mode (Expo Web)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:${DEV_PORT}`;
    }
    return `http://localhost:${DEV_PORT}`;
  }

  // 3. Try to dynamically detect Metro server IP from scriptURL
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:${DEV_PORT}`;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }

  // 4. Configured Wi-Fi LAN IP for physical devices or Expo Go
  if (DEV_MACHINE_IP && DEV_MACHINE_IP !== 'localhost') {
    return `http://${DEV_MACHINE_IP}:${DEV_PORT}`;
  }

  // 5. Android Studio Emulator standard loopback
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_PORT}`;
  }

  // 6. Default Localhost (iOS Simulator)
  return `http://localhost:${DEV_PORT}`;
};

export const getBackendServerUrl = () => getDynamicHost();
export const getApiBaseUrl = () => `${getDynamicHost()}/api`;
export const getUploadsBaseUrl = () => `${getDynamicHost()}/uploads`;

export const BACKEND_SERVER_URL = getDynamicHost();
export const API_BASE_URL = `${BACKEND_SERVER_URL}/api`;
export const UPLOADS_BASE_URL = `${BACKEND_SERVER_URL}/uploads`;

export default {
  USE_DEPLOYED_BACKEND,
  PROD_SERVER_URL,
  DEV_MACHINE_IP,
  DEV_PORT,
  BACKEND_SERVER_URL,
  API_BASE_URL,
  UPLOADS_BASE_URL,
  getDynamicHost,
  getBackendServerUrl,
  getApiBaseUrl,
  getUploadsBaseUrl
};
