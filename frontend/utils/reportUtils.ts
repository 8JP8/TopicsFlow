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
  const labels: Record<string, string> = {
    user: 'admin.typeUser',
    content: 'admin.typeContent',
    message: 'admin.typeMessage',
    post: 'admin.typePost',
    comment: 'admin.typeComment',
    chatroom: 'admin.typeChatroom',
    chatroom_background: 'admin.typeChatroomBackground',
    chatroom_picture: 'admin.typeChatroomPicture',
  };
  return labels[(type || '').toLowerCase()] || type;
};

// Get report status label and color
export const getReportStatusConfig = (status: ReportStatus): { label: string; color: string; bgColor: string } => {
  const configs: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: {
      label: 'admin.pendingReports',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    reviewed: {
      label: 'admin.reviewedReports',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    dismissed: {
      label: 'admin.dismissedReports',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    },
    resolved: {
      label: 'admin.resolvedReports',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
  };
  return configs[(status || '').toLowerCase()] || configs.pending;
};

// Get report reason label
export const getReportReasonLabel = (reason: ReportReason): string => {
  const labels: Record<string, string> = {
    spam: 'admin.reasonSpam',
    harassment: 'admin.reasonHarassment',
    hate_speech: 'admin.reasonHateSpeech',
    inappropriate_content: 'admin.reasonInappropriateContent',
    misinformation: 'admin.reasonMisinformation',
    violence: 'admin.reasonViolence',
    terrorism: 'admin.reasonTerrorism',
    racial_content: 'admin.reasonRacialContent',
    sexual_content: 'admin.reasonSexualContent',
    copyright: 'admin.reasonCopyright',
    privacy_violation: 'admin.reasonPrivacyViolation',
    impersonation: 'admin.reasonImpersonation',
    other: 'admin.reasonOther',
  };
  return labels[(reason || '').toLowerCase()] || reason;
};

// Get all report reasons for dropdown
export const getReportReasons = (): Array<{ value: ReportReason; label: string }> => {
  return [
    { value: 'spam', label: 'admin.reasonSpam' },
    { value: 'harassment', label: 'admin.reasonHarassment' },
    { value: 'hate_speech', label: 'admin.reasonHateSpeech' },
    { value: 'inappropriate_content', label: 'admin.reasonInappropriateContent' },
    { value: 'misinformation', label: 'admin.reasonMisinformation' },
    { value: 'violence', label: 'admin.reasonViolence' },
    { value: 'terrorism', label: 'admin.reasonTerrorism' },
    { value: 'racial_content', label: 'admin.reasonRacialContent' },
    { value: 'sexual_content', label: 'admin.reasonSexualContent' },
    { value: 'copyright', label: 'admin.reasonCopyright' },
    { value: 'privacy_violation', label: 'admin.reasonPrivacyViolation' },
    { value: 'impersonation', label: 'admin.reasonImpersonation' },
    { value: 'other', label: 'admin.reasonOther' },
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
