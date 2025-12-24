import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';
import { translate } from './translations';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // IMPORTANT:
    // In browser: 
    // - Production (Azure): Use `api.topicsflow.me` directly for CORS compatibility
    // - Local Development: Use `http://localhost:5000` directly (bypass Next.js proxy)
    // 
    // On the server (SSR/scripts), use BACKEND_IP or NEXT_PUBLIC_API_URL for absolute calls.
    const backendUrl = process.env.BACKEND_IP || process.env.NEXT_PUBLIC_API_URL;
    let baseURL: string;
    
    if (typeof window !== 'undefined') {
      // Browser: Check if we're in production (Azure)
      const isProduction = window.location.hostname === 'topicsflow.me' || 
                           window.location.hostname === 'www.topicsflow.me' ||
                           window.location.hostname.includes('azurestaticapps.net');
      
      if (isProduction && backendUrl) {
        // Production (Azure): Use backend URL directly (api.topicsflow.me)
        baseURL = backendUrl;
      } else if (isProduction) {
        // Production but no backend URL set: use api.topicsflow.me as default
        baseURL = 'https://api.topicsflow.me';
      } else {
        // Local Development: Always use localhost:5000 directly (no proxy)
        // This ensures direct connection to backend for better debugging
        baseURL = backendUrl || 'http://localhost:5000';
      }
    } else {
      // Server-side: use environment variable
      baseURL = backendUrl || 'http://localhost:5000';
    }

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Required for session cookies
    });
    
    // Debug: Log the baseURL in development
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      console.log('[ApiClient] Initialized with baseURL:', baseURL || '(empty - using relative paths, Next.js will proxy)');
    }

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
            if (path !== '/login' && path !== '/register' && path !== '/about') {
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
        } else if (error.message === 'Network Error' || error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED') {
          // Network error or connection refused (backend not running)
          if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            toast.error(translate('toast.backendNotRunning'));
          } else {
            toast.error(translate('toast.networkError'));
          }
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

  async delete<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.delete(url, { data });
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
    PASSKEY: {
      REGISTER_OPTIONS: '/api/auth/passkey/register-options',
      REGISTER_VERIFY: '/api/auth/passkey/register-verify',
      AUTH_OPTIONS: '/api/auth/passkey/auth-options',
      AUTH_VERIFY: '/api/auth/passkey/auth-verify',
      LIST: '/api/auth/passkey/list',
      DELETE: (id: string) => `/api/auth/passkey/${id}`,
      UPDATE: (id: string) => `/api/auth/passkey/${id}`,
    },
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
    INVITE: (id: string) => `/api/topics/${id}/invite`,
    GET_INVITATIONS: '/api/topics/invitations',
    ACCEPT_INVITATION: (id: string) => `/api/topics/invitations/${id}/accept`,
    DECLINE_INVITATION: (id: string) => `/api/topics/invitations/${id}/decline`,
    SILENCE: (id: string) => `/api/content-settings/topics/${id}/silence`,
    UNSILENCE: (id: string) => `/api/content-settings/topics/${id}/unsilence`,
    HIDE: (id: string) => `/api/content-settings/topics/${id}/hide`,
    UNHIDE: (id: string) => `/api/content-settings/topics/${id}/unhide`,
  },

  // Messages
  MESSAGES: {
    TOPIC_MESSAGES: (id: string) => `/api/messages/topic/${id}`,
    CREATE: (id: string) => `/api/messages/topic/${id}`,
    GET: (id: string) => `/api/messages/${id}`,
    DELETE: (id: string) => `/api/messages/${id}`,
    REPORT: (id: string) => `/api/messages/${id}/report`,
    REPORT_USER: (id: string) => `/api/messages/${id}/report-user`,
    REPORTS: (id: string) => `/api/messages/${id}/reports`,
    SEARCH: (id: string) => `/api/messages/topic/${id}/search`,
    USER_MESSAGES: (id: string) => `/api/messages/user/${id}`,
    TOPIC_STATS: (id: string) => `/api/messages/topic/${id}/stats`,
    USER_COUNT: (topicId: string, userId: string) => `/api/messages/topic/${topicId}/user/${userId}/count`,
    PRIVATE_MESSAGES: '/api/messages/private',
    SEND_PRIVATE: '/api/messages/private',
    PRIVATE_CONVERSATIONS: '/api/messages/private/conversations',
    MARK_READ: (id: string) => `/api/messages/private/${id}/read`,
    DELETE_PRIVATE: (id: string) => `/api/messages/private/${id}`,
    REPORT_PRIVATE: (id: string) => `/api/messages/private/${id}/report`,
  },

  // Reports
  REPORTS: {
    CREATE: '/api/reports',
    LIST: '/api/reports',
    GET: (id: string) => `/api/reports/${id}`,
    REVIEW: (id: string) => `/api/reports/${id}/review`,
    DISMISS: (id: string) => `/api/reports/${id}/dismiss`,
    ESCALATE: (id: string) => `/api/reports/${id}/escalate`,
    STATISTICS: '/api/reports/statistics',
    RECENT: '/api/reports/recent',
    USER_REPORTS: '/api/reports/my',
    MY_REPORTS: '/api/reports/my',
    DELETE: (id: string) => `/api/reports/${id}`,
  },

  // Users
  USERS: {
    PROFILE: '/api/users/profile',
    GET: (id: string) => `/api/users/${id}`,
    GET_BY_USERNAME: (username: string) => `/api/users/username/${username}`,
    SEARCH: '/api/users/search',
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
    DELETE_MESSAGE_FOR_ME: (messageId: string) => `/api/users/private-messages/${messageId}/delete-for-me`,
    RESTORE_MESSAGE_FOR_ME: (messageId: string) => `/api/users/private-messages/${messageId}/restore-for-me`,
    DELETED_MESSAGES: '/api/users/private-messages/deleted',
    STATS: '/api/users/stats',
    ONLINE_USERS: '/api/users/online',
    CHECK_USERNAME: '/api/users/check-username',
    CHECK_EMAIL: '/api/users/check-email',
    FRIENDS: '/api/users/friends',
    FRIEND_REQUESTS: '/api/users/friends/requests',
    SEND_FRIEND_REQUEST: '/api/users/friends/request',
    CHECK_FRIENDSHIP: (userId: string) => `/api/friends/check/${userId}`,
    ACCEPT_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/accept`,
    REJECT_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/reject`,
    CANCEL_FRIEND_REQUEST: (requestId: string) => `/api/users/friends/request/${requestId}/cancel`,
    REMOVE_FRIEND: (friendId: string) => `/api/users/friends/${friendId}`,
    BLOCK: (userId: string) => `/api/users/${userId}/block`,
    UNBLOCK: (userId: string) => `/api/users/${userId}/unblock`,
    BLOCKED_USERS: '/api/users/blocked',
    REQUEST_DELETION_CODE: '/api/users/request-deletion-code',
    DELETE_ACCOUNT: '/api/users/delete-account',
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


  // Posts (within Topics, Reddit-style)
  POSTS: {
    LIST_BY_TOPIC: (topicId: string) => `/api/posts/topics/${topicId}/posts`,
    RECENT: '/api/posts/recent',
    CREATE: (topicId: string) => `/api/posts/topics/${topicId}/posts`,
    GET: (id: string) => `/api/posts/${id}`,
    DELETE: (id: string) => `/api/posts/${id}`,
    UPVOTE: (id: string) => `/api/posts/${id}/upvote`,
    DOWNVOTE: (id: string) => `/api/posts/${id}/downvote`,
    REPORT: (id: string) => `/api/posts/${id}/report`,
    UPDATE_STATUS: (id: string) => `/api/posts/${id}/status`,
    SILENCE: (id: string) => `/api/content-settings/posts/${id}/silence`,
    UNSILENCE: (id: string) => `/api/content-settings/posts/${id}/unsilence`,
    HIDE: (id: string) => `/api/content-settings/posts/${id}/hide`,
    UNHIDE: (id: string) => `/api/content-settings/posts/${id}/unhide`,
  },
  CONTENT_SETTINGS: {
    HIDDEN_ITEMS: '/api/content-settings/hidden-items',
    SILENCED_ITEMS: '/api/content-settings/silenced-items',
    HIDE_CHAT: (id: string) => `/api/content-settings/chats/${id}/hide`,
    UNHIDE_CHAT: (id: string) => `/api/content-settings/chats/${id}/unhide`,
  },

  // Comments (new)
  COMMENTS: {
    LIST_BY_POST: (postId: string) => `/api/comments/posts/${postId}/comments`,
    CREATE: (postId: string) => `/api/comments/posts/${postId}/comments`,
    REPLY: (commentId: string) => `/api/comments/${commentId}/reply`,
    GET: (id: string) => `/api/comments/${id}`,
    DELETE: (id: string) => `/api/comments/${id}`,
    UPVOTE: (id: string) => `/api/comments/${id}/upvote`,
    DOWNVOTE: (id: string) => `/api/comments/${id}/downvote`,
    REPORT: (id: string) => `/api/comments/${id}/report`,
  },

  // Chat Rooms / Conversations (within Topics, Discord-style)
  CHAT_ROOMS: {
    LIST_BY_TOPIC: (topicId: string) => `/api/chat-rooms/topics/${topicId}/conversations`,
    LIST_GROUP: '/api/chat-rooms/group/list',
    CREATE: (topicId: string) => `/api/chat-rooms/topics/${topicId}/conversations`,
    CREATE_GROUP: '/api/chat-rooms/group',
    GET: (id: string) => `/api/chat-rooms/${id}`,
    UPDATE: (id: string) => `/api/chat-rooms/${id}`,
    DELETE: (id: string) => `/api/chat-rooms/${id}`,
    JOIN: (id: string) => `/api/chat-rooms/${id}/join`,
    LEAVE: (id: string) => `/api/chat-rooms/${id}/leave`,
    MESSAGES: (id: string) => `/api/chat-rooms/${id}/messages`,
    SEND_MESSAGE: (id: string) => `/api/chat-rooms/${id}/messages`,
    DELETE_MESSAGE: (roomId: string, messageId: string) => `/api/chat-rooms/${roomId}/messages/${messageId}`,
    GET_MEMBERS: (roomId: string) => `/api/chat-rooms/${roomId}/members`,
    ADD_MODERATOR: (id: string) => `/api/chat-rooms/${id}/moderators`,
    REMOVE_MODERATOR: (id: string, moderatorId: string) => `/api/chat-rooms/${id}/moderators/${moderatorId}`,
    BAN_USER: (id: string, userId: string) => `/api/chat-rooms/${id}/ban/${userId}`,
    UNBAN_USER: (id: string, userId: string) => `/api/chat-rooms/${id}/unban/${userId}`,
    KICK_USER: (id: string, userId: string) => `/api/chat-rooms/${id}/kick/${userId}`,
    INVITE_USER: (roomId: string) => `/api/chat-rooms/${roomId}/invite`,
    GET_INVITATIONS: '/api/chat-rooms/invitations',
    ACCEPT_INVITATION: (invitationId: string) => `/api/chat-rooms/invitations/${invitationId}/accept`,
    DECLINE_INVITATION: (invitationId: string) => `/api/chat-rooms/invitations/${invitationId}/decline`,
    UPDATE_PICTURE: (id: string) => `/api/chat-rooms/${id}/picture`,
    UPDATE_BACKGROUND: (id: string) => `/api/chat-rooms/${id}/background`,
    UPDATE_SETTINGS: (id: string) => `/api/chat-rooms/${id}/settings`,
  },

  // Blocking (new)
  BLOCKING: {
    BLOCK: (userId: string) => `/api/users/${userId}/block`,
    UNBLOCK: (userId: string) => `/api/users/${userId}/unblock`,
    LIST_BLOCKED: '/api/users/blocked',
  },

  // Admin
  ADMIN: {
    REPORTS: '/api/admin/reports',
    TICKETS: '/api/admin/tickets',
    BAN_USER: (userId: string) => `/api/admin/users/${userId}/ban`,
    UNBAN_USER: (userId: string) => `/api/admin/users/${userId}/unban`,
    BANNED_USERS: '/api/admin/users/banned',
    STATS: '/api/admin/stats',
    REPORT_ACTION: (reportId: string) => `/api/admin/reports/${reportId}/action`,
    REPORT_REOPEN: (reportId: string) => `/api/admin/reports/${reportId}/reopen`,
    TICKET_UPDATE: (ticketId: string) => `/api/admin/tickets/${ticketId}`,
    USER_MESSAGES: (userId: string) => `/api/admin/users/${userId}/messages`,
    DELETED_MESSAGES: '/api/admin/deleted-messages',
    PERMANENT_DELETE_MESSAGE: (messageId: string) => `/api/admin/deleted-messages/${messageId}/permanent-delete`,
    CLEANUP_EXPIRED_MESSAGES: '/api/admin/deleted-messages/cleanup-expired',
    PENDING_DELETIONS: '/api/admin/pending-deletions',
    APPROVE_TOPIC_DELETION: (topicId: string) => `/api/admin/topics/${topicId}/approve-deletion`,
    REJECT_TOPIC_DELETION: (topicId: string) => `/api/admin/topics/${topicId}/reject-deletion`,
    APPROVE_POST_DELETION: (postId: string) => `/api/admin/posts/${postId}/approve-deletion`,
    REJECT_POST_DELETION: (postId: string) => `/api/admin/posts/${postId}/reject-deletion`,
    APPROVE_CHATROOM_DELETION: (roomId: string) => `/api/admin/chatrooms/${roomId}/approve-deletion`,
    REJECT_CHATROOM_DELETION: (roomId: string) => `/api/admin/chatrooms/${roomId}/reject-deletion`,
  },


  // Tickets (user-facing)
  TICKETS: {
    CREATE: '/api/tickets',
    MY_TICKETS: '/api/tickets/my-tickets',
    GET_TICKET: (ticketId: string) => `/api/tickets/${ticketId}`,
    UPDATE: (ticketId: string) => `/api/tickets/${ticketId}`,
    DELETE: (ticketId: string) => `/api/tickets/${ticketId}`,
    CATEGORIES: '/api/tickets/categories',
  },

  // Mute features (add to USERS)
  MUTE: {
    MUTE_TOPIC: (topicId: string) => `/api/topics/${topicId}/mute`,
    UNMUTE_TOPIC: (topicId: string) => `/api/topics/${topicId}/unmute`,
    MUTE_CHAT: (chatRoomId: string) => `/api/chat-rooms/${chatRoomId}/mute`,
    UNMUTE_CHAT: (chatRoomId: string) => `/api/chat-rooms/${chatRoomId}/unmute`,
    MUTE_POST: (postId: string) => `/api/users/posts/${postId}/mute`,
    UNMUTE_POST: (postId: string) => `/api/users/posts/${postId}/unmute`,
    MUTE_CHAT_ROOM: (chatId: string) => `/api/users/chats/${chatId}/mute`,
    UNMUTE_CHAT_ROOM: (chatId: string) => `/api/users/chats/${chatId}/unmute`,
  },

  // Notification Settings
  NOTIFICATION_SETTINGS: {
    FOLLOW_POST: (postId: string) => `/api/notification-settings/posts/${postId}/follow`,
    UNFOLLOW_POST: (postId: string) => `/api/notification-settings/posts/${postId}/unfollow`,
    POST_STATUS: (postId: string) => `/api/notification-settings/posts/${postId}/status`,
    FOLLOWED_POSTS: '/api/notification-settings/posts/followed',
    FOLLOW_CHATROOM: (chatRoomId: string) => `/api/notification-settings/chatrooms/${chatRoomId}/follow`,
    UNFOLLOW_CHATROOM: (chatRoomId: string) => `/api/notification-settings/chatrooms/${chatRoomId}/unfollow`,
    CHATROOM_STATUS: (chatRoomId: string) => `/api/notification-settings/chatrooms/${chatRoomId}/status`,
    MUTE_TOPIC: (topicId: string) => `/api/notification-settings/topics/${topicId}/mute`,
    UNMUTE_TOPIC: (topicId: string) => `/api/notification-settings/topics/${topicId}/unmute`,
    TOPIC_STATUS: (topicId: string) => `/api/notification-settings/topics/${topicId}/status`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/api/notifications',
    UNREAD_COUNT: '/api/notifications/unread-count',
    MARK_READ: (notificationId: string) => `/api/notifications/${notificationId}/read`,
    MARK_ALL_READ: '/api/notifications/read-all',
    DELETE: (notificationId: string) => `/api/notifications/${notificationId}`,
    AGGREGATED: '/api/notifications/aggregated',
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

/**
 * Get the base API URL for direct fetch calls.
 * This should be used when you need to use fetch() directly instead of the api client.
 * 
 * @returns The base URL for API calls (empty string for dev, full URL for production)
 */
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable
    return process.env.BACKEND_IP || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  }
  
  // Browser: Check if we're in production (Azure)
  const isProduction = window.location.hostname === 'topicsflow.me' || 
                       window.location.hostname === 'www.topicsflow.me' ||
                       window.location.hostname.includes('azurestaticapps.net');
  
  const backendUrl = process.env.BACKEND_IP || process.env.NEXT_PUBLIC_API_URL;
  
  if (isProduction && backendUrl) {
    // Production: Use backend URL directly (api.topicsflow.me)
    return backendUrl;
  } else if (isProduction) {
    // Production but no backend URL set: use api.topicsflow.me as default
    return 'https://api.topicsflow.me';
  } else {
    // Local Development: Always use localhost:5000 directly (no proxy)
    return backendUrl || 'http://localhost:5000';
  }
};