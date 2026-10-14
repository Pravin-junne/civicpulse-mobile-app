import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, UPLOADS_BASE_URL, BACKEND_SERVER_URL, DEV_MACHINE_IP, getDynamicHost } from '../config/env';

export { API_BASE_URL, UPLOADS_BASE_URL, BACKEND_SERVER_URL, DEV_MACHINE_IP };

const TOKEN_KEY = 'user_jwt_token';
const USER_KEY = 'user_profile_data';
const ONBOARDING_KEY = 'onboarding_completed_v1';
const REMEMBER_ME_KEY = 'remember_me_preference';
const SAVED_IDENTIFIER_KEY = 'saved_login_identifier';

// Cross-Platform Storage Adapter (Handles Web localStorage & Native SecureStore)
export const storage = {
  getItem: async (key) => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
  },
  setItem: async (key, val) => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
      await SecureStore.setItemAsync(key, val);
    } catch (e) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    }
  },
  deleteItem: async (key) => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  }
};

/**
 * Resolves a relative uploaded file URL into a full accessible HTTP URL.
 * Automatically normalizes Windows-style backslashes and rewrites localhost/127.0.0.1 to the device's reachable host.
 */
export const resolveFileUrl = (rawUrl) => {
  if (!rawUrl) return '';
  if (typeof rawUrl !== 'string') return '';

  let normalized = rawUrl.replace(/\\/g, '/');
  const host = getDynamicHost ? getDynamicHost() : BACKEND_SERVER_URL;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    if (host && (normalized.includes('://localhost:') || normalized.includes('://127.0.0.1:'))) {
      normalized = normalized.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, host);
    }
    return normalized;
  }

  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${host}${cleanPath}`;
};

/**
 * Universal cross-platform helper to prepare file entries for FormData.
 * Automatically handles Native (Android file:// prefixes & explicit extensions)
 * as well as Web (Blob/File instances from blob: or data: URIs).
 */
export const prepareFormDataFile = async (item, fallbackType = 'image/jpeg') => {
  if (!item) return null;
  const rawUri = typeof item === 'string' ? item : item.uri;
  let name = typeof item === 'object' && item.name ? item.name : (typeof item === 'object' && item.fileName ? item.fileName : '');
  let type = typeof item === 'object' && item.type ? item.type : (typeof item === 'object' && item.mimeType ? item.mimeType : fallbackType);

  if (!type || type === 'image') type = fallbackType;

  // Ensure valid extension on name
  if (!name || !name.includes('.')) {
    const ext = type.includes('pdf') ? '.pdf' : (type.includes('png') ? '.png' : (type.includes('doc') ? '.docx' : '.jpg'));
    const base = name ? name.replace(/\.[^/.]+$/, '') : `file_${Date.now()}`;
    name = `${base}${ext}`;
  }

  // Web Browser Handling
  if (Platform.OS === 'web') {
    if (typeof item === 'object' && item.file && typeof Blob !== 'undefined' && item.file instanceof Blob) {
      return item.file;
    }
    if (rawUri && (rawUri.startsWith('blob:') || rawUri.startsWith('data:'))) {
      try {
        const response = await fetch(rawUri);
        const blob = await response.blob();
        if (typeof File !== 'undefined') {
          return new File([blob], name, { type: blob.type || type });
        }
        return blob;
      } catch (e) {
        console.warn('Web blob conversion notice:', e.message);
      }
    }
  }

  // Native Android & iOS Handling
  let fileUri = rawUri;
  if (Platform.OS === 'android' && fileUri && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
    fileUri = `file://${fileUri}`;
  }

  return {
    uri: fileUri,
    name,
    type
  };
};

let memoryToken = null;
let memoryUser = null;

// Create Centralized Axios Instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// 🔒 Request Interceptor: Attach JWT Bearer Token & ensure dynamic host
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const dynamicHost = getDynamicHost();
      if (dynamicHost) {
        config.baseURL = `${dynamicHost}/api`;
      }
      const isFormData =
        config.data instanceof FormData ||
        (config.data && typeof config.data.getParts === 'function');

      if (isFormData) {
        if (config.headers && typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
          config.headers.delete('content-type');
        } else if (config.headers) {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }

      let token = memoryToken;
      if (!token) {
        token = await storage.getItem(TOKEN_KEY);
        if (token) memoryToken = token;
      }

      if (token) {
        if (config.headers && typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn('Could not read token from storage:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🛡️ Response Interceptor: Format errors and handle 401s
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response) {
      // 401 Unauthorized / Token Expired
      if (error.response.status === 401) {
        try {
          await storage.deleteItem(TOKEN_KEY);
          await storage.deleteItem(USER_KEY);
        } catch (e) {
          // Ignore
        }
      }
      const message =
        error.response.data?.message ||
        error.response.data?.error ||
        `Server error: ${error.response.status}`;
      return Promise.reject(new Error(message));
    } else if (error.request) {
      const targetUrl = error.config?.baseURL || API_BASE_URL;
      return Promise.reject(
        new Error(`Unable to connect to server (${targetUrl}). Please verify backend is running.`)
      );
    }
    return Promise.reject(new Error(error.message || 'An unexpected error occurred.'));
  }
);

// 🔑 Authentication & Session Helper Methods
export const authService = {
  /**
   * Log in user with mobile number/username and password
   */
  login: async (identifier, password, rememberMe = true) => {
    const cleanId = (identifier || '').toString().trim();
    const data = await apiClient.post('/auth/login', {
      username: cleanId,
      mobileNumber: cleanId,
      identifier: cleanId,
      password
    });

    if (data.token) {
      memoryToken = data.token;
      await storage.setItem(TOKEN_KEY, data.token);
      if (data.user) {
        memoryUser = data.user;
        await storage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      if (rememberMe) {
        await storage.setItem(SAVED_IDENTIFIER_KEY, cleanId);
        await storage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        await storage.deleteItem(SAVED_IDENTIFIER_KEY);
        await storage.setItem(REMEMBER_ME_KEY, 'false');
      }
    }
    return data;
  },

  /**
   * Get saved login credentials/preferences
   */
  getSavedCredentials: async () => {
    try {
      const remember = await storage.getItem(REMEMBER_ME_KEY);
      const identifier = await storage.getItem(SAVED_IDENTIFIER_KEY);
      return {
        rememberMe: remember !== 'false',
        identifier: identifier || ''
      };
    } catch (e) {
      return { rememberMe: true, identifier: '' };
    }
  },

  /**
   * Onboarding status tracking
   */
  hasSeenOnboarding: async () => {
    try {
      const seen = await storage.getItem(ONBOARDING_KEY);
      return seen === 'true';
    } catch (e) {
      return false;
    }
  },

  setOnboardingCompleted: async () => {
    try {
      await storage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      console.warn('Failed to set onboarding flag:', e);
    }
  },

  /**
   * Get Current Stored JWT Token
   */
  getToken: async () => {
    if (memoryToken) return memoryToken;
    try {
      const token = await storage.getItem(TOKEN_KEY);
      if (token) memoryToken = token;
      return token;
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if active token exists
   */
  isLoggedIn: async () => {
    const token = await authService.getToken();
    return !!token;
  },

  /**
   * Get Current Stored User Profile
   */
  getStoredUser: async () => {
    if (memoryUser) return memoryUser;
    try {
      const userStr = await storage.getItem(USER_KEY);
      if (userStr) {
        memoryUser = JSON.parse(userStr);
        return memoryUser;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Fetch Fresh User Profile from Server
   */
  fetchProfile: async () => {
    const profile = await apiClient.get('/auth/profile');
    if (profile) {
      memoryUser = profile;
      await storage.setItem(USER_KEY, JSON.stringify(profile));
    }
    return profile;
  },

  /**
   * Log out and clear stored session
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout').catch(() => {});
    } finally {
      memoryToken = null;
      memoryUser = null;
      await storage.deleteItem(TOKEN_KEY);
      await storage.deleteItem(USER_KEY);
    }
  }
};

export default apiClient;
