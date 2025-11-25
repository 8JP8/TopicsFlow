import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { translate } from './translations';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Required for session cookies
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
        // Don't show generic errors if we have specific error messages
        const hasSpecificError = error.response?.data?.errors || error.response?.data?.message || error.response?.data?.error;
        
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login only if not already on auth pages
          if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path !== '/login' && path !== '/register') {
              window.location.href = '/login';
            }
          }
          // Don't show toast for 401 - let the calling code handle it
        } else if (error.response?.status >= 500 && !hasSpecificError) {
          // Server error - only show if no specific error message
          toast.error(translate('toast.serverError'));
        } else if (error.code === 'ECONNABORTED') {
          // Timeout
          toast.error(translate('toast.requestTimeout'));
        } else if (error.message === 'Network Error') {
          // Network error
          toast.error(translate('toast.networkError'));
        }
        // For other errors (400, 404, etc.), let the calling code handle the error message

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
    LOGIN: '/api/auth/login-passwordless', // Passwordless login with TOTP
    LOGIN_WITH_PASSWORD: '/api/auth/login', // Password + TOTP login (legacy)
    LOGIN_BACKUP: '/api/auth/login-passwordless-backup', // Passwordless login with backup code
    LOGIN_BACKUP_WITH_PASSWORD: '/api/auth/login-backup', // Password + backup code (legacy)
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    COMPLETE_TOTP: '/api/auth/totp/complete',
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
    MUTE_CONVERSATION: (userId: string) => `/api/users/private-messages/${userId}/mute`,
    BLOCK_USER_LEGACY: (userId: string) => `/api/users/block/${userId}`, // Legacy - kept for compatibility
    DELETE_CONVERSATION: (userId: string) => `/api/users/private-messages/${userId}`,
    SEARCH: '/api/users/search',
    STATS: '/api/users/stats',
    ONLINE_USERS: '/api/users/online',
    CHECK_USERNAME: '/api/users/check-username',
    CHECK_EMAIL: '/api/users/check-email',
    FRIENDS: '/api/users/friends',
    FRIEND_REQUESTS: '/api/users/friends/requests',
    SEND_FRIEND_REQUEST: '/api/users/friends/request',
    ACCEPT_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/accept`,
    REJECT_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/reject`,
    CANCEL_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/cancel`,
    REMOVE_FRIEND: (friendId: string) => `/api/users/friends/${friendId}`,
  },

  // GIFs
  GIFS: {
    SEARCH: '/api/gifs/search',
    TRENDING: '/api/gifs/trending',
    POPULAR: '/api/gifs/popular',
    RECENT: '/api/gifs/recent',
    CATEGORIES: '/api/gifs/categories',
    REGISTER_SHARE: '/api/gifs/register-share',
  },

  // Themes (new - within Topics, Reddit-style)
  THEMES: {
    LIST_BY_TOPIC: (topicId: string) => `/api/themes/topics/${topicId}`,
    CREATE: (topicId: string) => `/api/themes/topics/${topicId}`,
    GET: (id: string) => `/api/themes/${id}`,
    UPDATE: (id: string) => `/api/themes/${id}`,
    DELETE: (id: string) => `/api/themes/${id}`,
    JOIN: (id: string) => `/api/themes/${id}/join`,
    LEAVE: (id: string) => `/api/themes/${id}/leave`,
    MODERATORS: (id: string) => `/api/themes/${id}/moderators`,
    ADD_MODERATOR: (id: string) => `/api/themes/${id}/moderators`,
    REMOVE_MODERATOR: (id: string, moderatorId: string) => `/api/themes/${id}/moderators/${moderatorId}`,
    BAN_USER: (id: string) => `/api/themes/${id}/ban`,
    UNBAN_USER: (id: string) => `/api/themes/${id}/unban`,
    TRANSFER_OWNERSHIP: (id: string) => `/api/themes/${id}/transfer-ownership`,
    USER_THEMES: '/api/themes/my',
    ANONYMOUS_IDENTITY: (id: string) => `/api/themes/${id}/anonymous-identity`,
    // Legacy - kept for backward compatibility (returns error)
    LIST: '/api/themes',
  },

  // Posts (within Topics, Reddit-style)
  POSTS: {
    LIST_BY_TOPIC: (topicId: string) => `/api/posts/topics/${topicId}/posts`,
    CREATE: (topicId: string) => `/api/posts/topics/${topicId}/posts`,
    GET: (id: string) => `/api/posts/${id}`,
    DELETE: (id: string) => `/api/posts/${id}`,
    UPVOTE: (id: string) => `/api/posts/${id}/upvote`,
    DOWNVOTE: (id: string) => `/api/posts/${id}/downvote`,
    REPORT: (id: string) => `/api/posts/${id}/report`,
    // Legacy - kept for backward compatibility
    LIST_BY_THEME: (themeId: string) => `/api/posts/themes/${themeId}/posts`,
  },

  // Comments (new)
  COMMENTS: {
    LIST_BY_POST: (postId: string) => `/api/comments/posts/${postId}/comments`,
    CREATE: (postId: string) => `/api/comments/posts/${postId}/comments`,
    REPLY: (commentId: string) => `/api/comments/${commentId}/reply`,
    GET: (id: string) => `/api/comments/${id}`,
    DELETE: (id: string) => `/api/comments/${id}`,
    UPVOTE: (id: string) => `/api/comments/${id}/upvote`,
    REPORT: (id: string) => `/api/comments/${id}/report`,
  },

  // Chat Rooms / Conversations (within Topics, Discord-style)
  CHAT_ROOMS: {
    LIST_BY_TOPIC: (topicId: string) => `/api/chat-rooms/topics/${topicId}/conversations`,
    CREATE: (topicId: string) => `/api/chat-rooms/topics/${topicId}/conversations`,
    GET: (id: string) => `/api/chat-rooms/${id}`,
    DELETE: (id: string) => `/api/chat-rooms/${id}`,
    JOIN: (id: string) => `/api/chat-rooms/${id}/join`,
    LEAVE: (id: string) => `/api/chat-rooms/${id}/leave`,
    MESSAGES: (id: string) => `/api/chat-rooms/${id}/messages`,
    SEND_MESSAGE: (id: string) => `/api/chat-rooms/${id}/messages`,
    ADD_MODERATOR: (id: string) => `/api/chat-rooms/${id}/moderators`,
    REMOVE_MODERATOR: (id: string, moderatorId: string) => `/api/chat-rooms/${id}/moderators/${moderatorId}`,
    BAN_USER: (id: string, userId: string) => `/api/chat-rooms/${id}/ban/${userId}`,
    UNBAN_USER: (id: string, userId: string) => `/api/chat-rooms/${id}/unban/${userId}`,
    // Legacy - kept for backward compatibility
    LIST_BY_THEME: (themeId: string) => `/api/chat-rooms/themes/${themeId}/chat-rooms`,
  },

  // Blocking (new)
  BLOCKING: {
    BLOCK: (userId: string) => `/api/users/${userId}/block`,
    UNBLOCK: (userId: string) => `/api/users/${userId}/block`,
    LIST_BLOCKED: '/api/users/blocked',
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