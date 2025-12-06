// Ticket types
export type TicketCategory = 'bug' | 'feature' | 'account' | 'abuse' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// Ticket interface
export interface Ticket {
  id: string;
  user_id: string;
  username?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  username?: string;
  is_admin: boolean;
  message: string;
  created_at: string;
}

// Get ticket category label and icon
export const getTicketCategoryConfig = (category: TicketCategory): { label: string; icon: string; color: string } => {
  const configs: Record<TicketCategory, { label: string; icon: string; color: string }> = {
    bug: {
      label: 'Bug Report',
      icon: '🐛',
      color: 'text-red-600 dark:text-red-400',
    },
    feature: {
      label: 'Feature Request',
      icon: '✨',
      color: 'text-purple-600 dark:text-purple-400',
    },
    account: {
      label: 'Account Issue',
      icon: '👤',
      color: 'text-blue-600 dark:text-blue-400',
    },
    abuse: {
      label: 'Abuse Report',
      icon: '⚠️',
      color: 'text-orange-600 dark:text-orange-400',
    },
    other: {
      label: 'Other',
      icon: '📝',
      color: 'text-gray-600 dark:text-gray-400',
    },
  };
  return configs[category] || configs.other;
};

// Get ticket status label and color
export const getTicketStatusConfig = (status: TicketStatus): { label: string; color: string; bgColor: string } => {
  const configs: Record<TicketStatus, { label: string; color: string; bgColor: string }> = {
    open: {
      label: 'Open',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    in_progress: {
      label: 'In Progress',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    resolved: {
      label: 'Resolved',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    closed: {
      label: 'Closed',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    },
  };
  return configs[status] || configs.open;
};

// Get ticket priority label and color
export const getTicketPriorityConfig = (priority: TicketPriority): { label: string; color: string; bgColor: string } => {
  const configs: Record<TicketPriority, { label: string; color: string; bgColor: string }> = {
    low: {
      label: 'Low',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    },
    medium: {
      label: 'Medium',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    high: {
      label: 'High',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    urgent: {
      label: 'Urgent',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
  };
  return configs[priority] || configs.medium;
};

// Get all ticket categories for dropdown
export const getTicketCategories = (): Array<{ value: TicketCategory; label: string; icon: string }> => {
  return [
    { value: 'bug', label: 'Bug Report', icon: '🐛' },
    { value: 'feature', label: 'Feature Request', icon: '✨' },
    { value: 'account', label: 'Account Issue', icon: '👤' },
    { value: 'abuse', label: 'Abuse Report', icon: '⚠️' },
    { value: 'other', label: 'Other', icon: '📝' },
  ];
};

// Get all ticket priorities for dropdown
export const getTicketPriorities = (): Array<{ value: TicketPriority; label: string }> => {
  return [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];
};

// Format ticket date
export const formatTicketDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};
