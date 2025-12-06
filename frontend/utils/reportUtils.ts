// Report types
export type ReportType = 'user' | 'content' | 'message' | 'post' | 'comment' | 'chatroom' | 'chatroom_background' | 'chatroom_picture';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'resolved';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'inappropriate_content'
  | 'misinformation'
  | 'violence'
  | 'terrorism'
  | 'racial_content'
  | 'sexual_content'
  | 'copyright'
  | 'privacy_violation'
  | 'impersonation'
  | 'other';

// Report interface
export interface Report {
  id: string;
  reporter_id: string;
  reporter_username?: string;
  reported_user_id?: string;
  reported_username?: string;
  report_type: ReportType;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  content_id?: string;
  content_type?: string;
  content_data?: any; // Content-specific data (message, post, comment, chatroom)
  created_at: string;
  updated_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

// Get report type label
export const getReportTypeLabel = (type: ReportType): string => {
  const labels: Record<ReportType, string> = {
    user: 'User',
    content: 'Content',
    message: 'Message',
    post: 'Post',
    comment: 'Comment',
    chatroom: 'Chatroom',
    chatroom_background: 'Chatroom Background',
    chatroom_picture: 'Chatroom Picture',
  };
  return labels[type] || type;
};

// Get report status label and color
export const getReportStatusConfig = (status: ReportStatus): { label: string; color: string; bgColor: string } => {
  const configs: Record<ReportStatus, { label: string; color: string; bgColor: string }> = {
    pending: {
      label: 'Pending',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    reviewed: {
      label: 'Reviewed',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    dismissed: {
      label: 'Dismissed',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    },
    resolved: {
      label: 'Resolved',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
  };
  return configs[status] || configs.pending;
};

// Get report reason label
export const getReportReasonLabel = (reason: ReportReason): string => {
  const labels: Record<ReportReason, string> = {
    spam: 'Spam',
    harassment: 'Harassment',
    hate_speech: 'Hate Speech',
    inappropriate_content: 'Inappropriate Content',
    misinformation: 'Misinformation',
    violence: 'Violence',
    terrorism: 'Terrorism',
    racial_content: 'Racial Content',
    sexual_content: 'Sexual Content',
    copyright: 'Copyright Violation',
    privacy_violation: 'Privacy Violation',
    impersonation: 'Impersonation',
    other: 'Other',
  };
  return labels[reason] || reason;
};

// Get all report reasons for dropdown
export const getReportReasons = (): Array<{ value: ReportReason; label: string }> => {
  return [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate Speech' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'violence', label: 'Violence' },
    { value: 'terrorism', label: 'Terrorism' },
    { value: 'racial_content', label: 'Racial Content' },
    { value: 'sexual_content', label: 'Sexual Content' },
    { value: 'copyright', label: 'Copyright Violation' },
    { value: 'privacy_violation', label: 'Privacy Violation' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'other', label: 'Other' },
  ];
};

// Format report date
export const formatReportDate = (dateString: string): string => {
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
