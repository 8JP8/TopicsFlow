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
      withCredentials: true, // Important for session-based authentication
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
    LOGIN: '/auth/login',
    LOGIN_BACKUP: '/auth/login-backup',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    VERIFY_TOTP: '/auth/verify-totp',
    BACKUP_CODES: '/auth/backup-codes',
    CHANGE_PASSWORD: '/auth/change-password',
    PREFERENCES: '/auth/preferences',
    RECOVERY_INITIATE: '/auth/recovery/initiate',
    RECOVERY_VERIFY_SMS: '/auth/recovery/verify-sms',
    RECOVERY_VERIFY_QUESTIONS: '/auth/recovery/verify-questions',
    RECOVERY_CONFIRM_TOTP: '/auth/recovery/confirm-totp',
    SESSION: '/auth/session',
  },

  // Topics
  TOPICS: {
    LIST: '/topics',
    CREATE: '/topics',
    GET: (id: string) => `/topics/${id}`,
    UPDATE: (id: string) => `/topics/${id}`,
    DELETE: (id: string) => `/topics/${id}`,
    JOIN: (id: string) => `/topics/${id}/join`,
    LEAVE: (id: string) => `/topics/${id}/leave`,
    MODERATORS: (id: string) => `/topics/${id}/moderators`,
    ADD_MODERATOR: (id: string) => `/topics/${id}/moderators`,
    REMOVE_MODERATOR: (id: string) => `/topics/${id}/moderators`,
    BAN_USER: (id: string) => `/topics/${id}/ban`,
    UNBAN_USER: (id: string) => `/topics/${id}/unban`,
    TRANSFER_OWNERSHIP: (id: string) => `/topics/${id}/transfer-ownership`,
    USER_TOPICS: '/topics/my',
    ANONYMOUS_IDENTITY: (id: string) => `/topics/${id}/anonymous-identity`,
  },

  // Messages
  MESSAGES: {
    TOPIC_MESSAGES: (id: string) => `/messages/topic/${id}`,
    CREATE: (id: string) => `/messages/topic/${id}`,
    GET: (id: string) => `/messages/${id}`,
    DELETE: (id: string) => `/messages/${id}`,
    REPORT: (id: string) => `/messages/${id}/report`,
    REPORTS: (id: string) => `/messages/${id}/reports`,
    SEARCH: (id: string) => `/messages/topic/${id}/search`,
    USER_MESSAGES: (id: string) => `/messages/user/${id}`,
    TOPIC_STATS: (id: string) => `/messages/topic/${id}/stats`,
    USER_COUNT: (topicId: string, userId: string) => `/messages/topic/${topicId}/user/${userId}/count`,
    PRIVATE_MESSAGES: '/messages/private',
    SEND_PRIVATE: '/messages/private',
    PRIVATE_CONVERSATIONS: '/messages/private/conversations',
    MARK_READ: (id: string) => `/messages/private/${id}/read`,
  },

  // Reports
  REPORTS: {
    LIST: '/reports',
    GET: (id: string) => `/reports/${id}`,
    REVIEW: (id: string) => `/reports/${id}/review`,
    DISMISS: (id: string) => `/reports/${id}/dismiss`,
    ESCALATE: (id: string) => `/reports/${id}/escalate`,
    STATISTICS: '/reports/statistics',
    RECENT: '/reports/recent',
    USER_REPORTS: '/reports/my',
    DELETE: (id: string) => `/reports/${id}`,
  },

  // Users
  USERS: {
    PROFILE: '/users/profile',
    GET: (id: string) => `/users/${id}`,
    GET_BY_USERNAME: (username: string) => `/users/username/${username}`,
    TOPICS: '/users/topics',
    ANONYMOUS_IDENTITIES: '/users/anonymous-identities',
    DELETE_ANONYMOUS_IDENTITY: (topicId: string) => `/users/anonymous-identities/${topicId}`,
    PRIVATE_CONVERSATIONS: '/users/private-messages/conversations',
    PRIVATE_CONVERSATION: (userId: string) => `/users/private-messages/${userId}`,
    UNREAD_COUNT: '/users/private-messages/unread-count',
    MARK_CONVERSATION_READ: (userId: string) => `/users/private-messages/${userId}/read`,
    SEARCH: '/users/search',
    STATS: '/users/stats',
    ONLINE_USERS: '/users/online',
    CHECK_USERNAME: '/users/check-username',
    CHECK_EMAIL: '/users/check-email',
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
    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};