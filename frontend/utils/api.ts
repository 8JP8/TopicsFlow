import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: false, // Disabled for CORS testing
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // You can add auth token here if using token-based auth
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        } else if (error.response?.status >= 500) {
          // Server error
          toast.error('Server error. Please try again later.');
        } else if (error.code === 'ECONNABORTED') {
          // Timeout
          toast.error('Request timeout. Please check your connection.');
        } else if (error.message === 'Network Error') {
          // Network error
          toast.error('Network error. Please check your connection.');
        }

        return Promise.reject(error);
      }
    );
  }

  // HTTP methods
  async get<T = any>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.client.get(url, { params });
  }

  async post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.post(url, data);
  }

  async put<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.put(url, data);
  }

  async patch<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data);
  }

  async delete<T = any>(url: string): Promise<AxiosResponse<T>> {
    return this.client.delete(url);
  }

  // File upload
  async upload<T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
}

export const api = new ApiClient();

// API endpoint constants
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGIN_BACKUP: '/api/auth/login-backup',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    VERIFY_TOTP: '/api/auth/verify-totp',
    BACKUP_CODES: '/api/auth/backup-codes',
    CHANGE_PASSWORD: '/api/auth/change-password',
    PREFERENCES: '/api/auth/preferences',
    RECOVERY_INITIATE: '/api/auth/recovery/initiate',
    RECOVERY_VERIFY_SMS: '/api/auth/recovery/verify-sms',
    RECOVERY_VERIFY_QUESTIONS: '/api/auth/recovery/verify-questions',
    RECOVERY_CONFIRM_TOTP: '/api/auth/recovery/confirm-totp',
    SESSION: '/api/auth/session',
  },

  // Topics
  TOPICS: {
    LIST: '/api/topics',
    CREATE: '/api/topics',
    GET: (id: string) => `/api/topics/${id}`,
    UPDATE: (id: string) => `/api/topics/${id}`,
    DELETE: (id: string) => `/api/topics/${id}`,
    JOIN: (id: string) => `/api/topics/${id}/join`,
    LEAVE: (id: string) => `/api/topics/${id}/leave`,
    MODERATORS: (id: string) => `/api/topics/${id}/moderators`,
    ADD_MODERATOR: (id: string) => `/api/topics/${id}/moderators`,
    REMOVE_MODERATOR: (id: string) => `/api/topics/${id}/moderators`,
    BAN_USER: (id: string) => `/api/topics/${id}/ban`,
    UNBAN_USER: (id: string) => `/api/topics/${id}/unban`,
    TRANSFER_OWNERSHIP: (id: string) => `/api/topics/${id}/transfer-ownership`,
    USER_TOPICS: '/api/topics/my',
    ANONYMOUS_IDENTITY: (id: string) => `/api/topics/${id}/anonymous-identity`,
  },

  // Messages
  MESSAGES: {
    TOPIC_MESSAGES: (id: string) => `/api/messages/topic/${id}`,
    CREATE: (id: string) => `/api/messages/topic/${id}`,
    GET: (id: string) => `/api/messages/${id}`,
    DELETE: (id: string) => `/api/messages/${id}`,
    REPORT: (id: string) => `/api/messages/${id}/report`,
    REPORTS: (id: string) => `/api/messages/${id}/reports`,
    SEARCH: (id: string) => `/api/messages/topic/${id}/search`,
    USER_MESSAGES: (id: string) => `/api/messages/user/${id}`,
    TOPIC_STATS: (id: string) => `/api/messages/topic/${id}/stats`,
    USER_COUNT: (topicId: string, userId: string) => `/api/messages/topic/${topicId}/user/${userId}/count`,
    PRIVATE_MESSAGES: '/api/messages/private',
    SEND_PRIVATE: '/api/messages/private',
    PRIVATE_CONVERSATIONS: '/api/messages/private/conversations',
    MARK_READ: (id: string) => `/api/messages/private/${id}/read`,
  },

  // Reports
  REPORTS: {
    LIST: '/api/reports',
    GET: (id: string) => `/api/reports/${id}`,
    REVIEW: (id: string) => `/api/reports/${id}/review`,
    DISMISS: (id: string) => `/api/reports/${id}/dismiss`,
    ESCALATE: (id: string) => `/api/reports/${id}/escalate`,
    STATISTICS: '/api/reports/statistics',
    RECENT: '/api/reports/recent',
    USER_REPORTS: '/api/reports/my',
    DELETE: (id: string) => `/api/reports/${id}`,
  },

  // Users
  USERS: {
    PROFILE: '/api/users/profile',
    GET: (id: string) => `/api/users/${id}`,
    GET_BY_USERNAME: (username: string) => `/api/users/username/${username}`,
    TOPICS: '/api/users/topics',
    ANONYMOUS_IDENTITIES: '/api/users/anonymous-identities',
    DELETE_ANONYMOUS_IDENTITY: (topicId: string) => `/api/users/anonymous-identities/${topicId}`,
    PRIVATE_CONVERSATIONS: '/api/users/private-messages/conversations',
    PRIVATE_CONVERSATION: (userId: string) => `/api/users/private-messages/${userId}`,
    UNREAD_COUNT: '/api/users/private-messages/unread-count',
    MARK_CONVERSATION_READ: (userId: string) => `/api/users/private-messages/${userId}/read`,
    SEARCH: '/api/users/search',
    STATS: '/api/users/stats',
    ONLINE_USERS: '/api/users/online',
    CHECK_USERNAME: '/api/users/check-username',
    CHECK_EMAIL: '/api/users/check-email',
  },
} as const;

// Type definitions for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    limit: number;
    offset: number;
    total_count: number;
    has_more: boolean;
  };
}

// Error handling utility
export const handleApiError = (error: any, customMessage?: string) => {
  if (error.response?.data?.errors) {
    return error.response.data.errors.join(', ');
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (customMessage) {
    return customMessage;
  }
  return 'An unexpected error occurred';
};

// Request utilities
export const createQueryParams = (params: Record<string, any>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v.toString()));
      } else {
        searchParams.append(key, value.toString());
      }
    }
  });

  return searchParams.toString();
};

// Cache utilities
export const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export const cachedGet = async <T = any>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> => {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now(), ttl });

  return data;
};

export const clearCache = (pattern?: string) => {
  if (pattern) {
    const regex = new RegExp(pattern);
    for (const key of Array.from(cache.keys())) {
      if (regex.test(key)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};