import React, { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import {
  Report,
  ReportStatus,
  getReportStatusConfig,
  getReportTypeLabel,
  getReportReasonLabel,
  formatReportDate,
} from '@/utils/reportUtils';
import BanUserDialog from './BanUserDialog';
import WarnUserDialog from './WarnUserDialog';
import ImageViewerModal from '../UI/ImageViewerModal';
import VideoPlayer from '../UI/VideoPlayer';

interface ReportsModalProps {
  onClose: () => void;
}

const ReportsModal: React.FC<ReportsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banUserId, setBanUserId] = useState<string>('');
  const [banUsername, setBanUsername] = useState<string>('');
  const [showWarnDialog, setShowWarnDialog] = useState(false);
  const [warnReportId, setWarnReportId] = useState<string>('');
  const [warnUserId, setWarnUserId] = useState<string>('');
  const [warnUsername, setWarnUsername] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [showMessageHistory, setShowMessageHistory] = useState(false);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; filename: string } | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchReports();
  }, [filterStatus, filterContentType, page]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };
      // Only add status filter if it's not 'all'
      if (filterStatus && filterStatus !== 'all') {
        params.status = filterStatus;
      }
      // Add content_type filter if not 'all'
      if (filterContentType && filterContentType !== 'all') {
        params.content_type = filterContentType;
      }

      console.log('[ReportsModal] Fetching reports with params:', params);
      const response = await api.get(API_ENDPOINTS.ADMIN.REPORTS, { params });
      if (response.data.success) {
        let reportsData = response.data.data || [];

        // Frontend-side filtering as fallback (in case backend doesn't filter correctly)
        if (filterStatus && filterStatus !== 'all') {
          reportsData = reportsData.filter((report: Report) => report.status === filterStatus);
        }

        console.log('[ReportsModal] Received reports:', reportsData.length, 'with status filter:', filterStatus);
        setReports(reportsData);
        // Update pagination based on filtered results
        const currentOffset = (page - 1) * limit;
        const filteredCount = reportsData.length;
        const totalFromBackend = response.data.pagination?.total || 0;
        setHasMore(filteredCount === limit && (currentOffset + limit < totalFromBackend));
      }
    } catch (error) {
      console.error('[ReportsModal] Error fetching reports:', error);
      toast.error(t('admin.failedToLoadReports') || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (reportId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.REPORT_ACTION(reportId), {
        action: 'dismiss',
      });
      if (response.data.success) {
        toast.success(t('admin.reportDismissed') || 'Report dismissed');
        fetchReports();
        setSelectedReport(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToDismissReport') || 'Failed to dismiss report');
    }
  };

  const handleResolve = async (reportId: string, action: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.REPORT_ACTION(reportId), {
        action,
      });
      if (response.data.success) {
        toast.success(t('admin.reportResolved') || 'Report resolved');
        fetchReports();
        setSelectedReport(null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToResolveReport') || 'Failed to resolve report');
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.REPORT_ACTION(reportId), {
        action: 'resolve',
      });
      if (response.data.success) {
        toast.success(t('admin.reportResolved') || 'Report resolved');
        fetchReports();
        if (selectedReport?.id === reportId) {
          // Refresh report details
          const reportsRes = await api.get(API_ENDPOINTS.ADMIN.REPORTS, {
            params: { limit: 1000, offset: 0 },
          });
          if (reportsRes.data.success) {
            const updatedReport = reportsRes.data.data.find((r: any) => r.id === reportId);
            if (updatedReport) {
              setSelectedReport(updatedReport);
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToResolveReport') || 'Failed to resolve report');
    }
  };

  const handleReopenReport = async (reportId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.ADMIN.REPORT_REOPEN(reportId), {
        reason: 'Report reopened by admin',
      });
      if (response.data.success) {
        toast.success(t('admin.reportReopened') || 'Report reopened successfully');
        fetchReports();
        if (selectedReport?.id === reportId) {
          // Refresh report details
          const reportsRes = await api.get(API_ENDPOINTS.ADMIN.REPORTS, {
            params: { limit: 1000, offset: 0 },
          });
          if (reportsRes.data.success) {
            const updatedReport = reportsRes.data.data.find((r: any) => r.id === reportId);
            if (updatedReport) {
              setSelectedReport(updatedReport);
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('admin.failedToReopenReport') || 'Failed to reopen report');
    }
  };

  const handleBanUser = (userId: string, username: string) => {
    setBanUserId(userId);
    setBanUsername(username);
    setShowBanDialog(true);
  };

  const handleWarnUser = (reportId: string, userId: string, username: string) => {
    setWarnReportId(reportId);
    setWarnUserId(userId);
    setWarnUsername(username);
    setShowWarnDialog(true);
  };

  const handleShowMessageHistory = async (userId: string) => {
    try {
      setLoadingMessages(true);
      setShowMessageHistory(true);
      const response = await api.get(API_ENDPOINTS.ADMIN.USER_MESSAGES(userId), {
        params: { limit: 50, offset: 0 }
      });
      if (response.data.success) {
        setMessageHistory(response.data.data || []);
      }
    } catch (error) {
      toast.error(t('admin.failedToLoadMessages') || 'Failed to load message history');
    } finally {
      setLoadingMessages(false);
    }
  };

  const statusOptions: Array<{ value: ReportStatus | 'all'; label: string }> = [
    { value: 'all', label: t('admin.allReports') || 'All' },
    { value: 'pending', label: t('admin.pendingReports') || 'Pending' },
    { value: 'reviewed', label: t('admin.reviewedReports') || 'Reviewed' },
    { value: 'dismissed', label: t('admin.dismissedReports') || 'Dismissed' },
    { value: 'resolved', label: t('admin.resolvedReports') || 'Resolved' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b theme-border flex items-center justify-between">
            <h2 className="text-2xl font-semibold theme-text-primary">
              {t('admin.reports') || 'Reports Management'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
            >
              <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b theme-border">
            <div className="flex items-center space-x-4 flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium theme-text-primary">
                  {t('admin.filterByStatus') || 'Filter by status:'}
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as ReportStatus | 'all');
                    setPage(1);
                  }}
                  className="px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium theme-text-primary">
                  {t('admin.filterByType') || 'Filter by type:'}
                </label>
                <select
                  value={filterContentType}
                  onChange={(e) => {
                    setFilterContentType(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 theme-bg-primary theme-border rounded-lg theme-text-primary text-sm"
                >
                  <option value="all">{t('admin.allTypes') || 'All Types'}</option>
                  <option value="user">{t('admin.typeUser') || 'User Reports'}</option>
                  <option value="message">{t('admin.typeMessage') || 'Message Reports'}</option>
                  <option value="post">{t('admin.typePost') || 'Post Reports'}</option>
                  <option value="comment">{t('admin.typeComment') || 'Comment Reports'}</option>
                  <option value="chatroom">{t('admin.typeChatroom') || 'Chatroom Reports'}</option>
                  <option value="chatroom_background">{t('admin.typeChatroomBackground') || 'Chatroom Background'}</option>
                  <option value="chatroom_picture">{t('admin.typeChatroomPicture') || 'Chatroom Picture'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Reports List */}
            <div className={`${selectedReport ? 'w-1/2' : 'w-full'} border-r theme-border overflow-y-auto`}>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 theme-text-muted">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p>{t('admin.noReports') || 'No reports found'}</p>
                </div>
              ) : (
                <div className="divide-y theme-border">
                  {reports.map((report) => {
                    const statusConfig = getReportStatusConfig(report.status);
                    return (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={`w-full p-4 text-left hover:theme-bg-tertiary transition-colors ${selectedReport?.id === report.id ? 'theme-bg-tertiary' : ''
                          }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <span className="font-semibold theme-text-primary">
                                {(report as any).content_type ? getReportTypeLabel((report as any).content_type as any) : getReportTypeLabel(report.report_type)}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                {statusConfig.label}
                              </span>
                              {(report as any).content_type && (report as any).content_type !== (report as any).report_type && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                  {getReportTypeLabel(report.report_type)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm theme-text-muted">
                              {t('admin.reportedBy') || 'Reported by'}: {report.reporter_username || 'Unknown'}
                            </p>
                            {report.reported_username && (
                              <p className="text-sm theme-text-muted">
                                {t('admin.reportedUser') || 'User'}: {report.reported_username}
                              </p>
                            )}
                            {(report as any).content_type && ((report as any).content_type === 'chatroom' || (report as any).content_type === 'chatroom_background' || (report as any).content_type === 'chatroom_picture') && (
                              <p className="text-sm theme-text-muted">
                                {t('admin.typeChatroom') || 'Chatroom Report'}
                              </p>
                            )}
                          </div>
                          <span className="text-xs theme-text-muted whitespace-nowrap">
                            {formatReportDate(report.created_at)}
                          </span>
                        </div>
                        <p className="text-sm theme-text-primary">
                          {t('admin.reason') || 'Reason'}: {getReportReasonLabel(report.reason)}
                        </p>
                        {(report as any).content_data && (report as any).content_type === 'chatroom' && (
                          <p className="text-xs theme-text-muted mt-1">
                            {(report as any).content_data.name || 'Chatroom'}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Report Details */}
            {selectedReport && (
              <div className="w-1/2 overflow-y-auto p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold theme-text-primary mb-4">
                      {t('admin.reportDetails') || 'Report Details'}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.reportType') || 'Type'}
                      </label>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          {getReportTypeLabel(selectedReport.report_type)}
                        </span>
                        {(selectedReport as any).content_type && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {(selectedReport as any).content_type === 'user' ? t('admin.typeUser') || 'User' :
                              (selectedReport as any).content_type === 'message' ? t('admin.typeMessage') || 'Message' :
                                (selectedReport as any).content_type === 'post' ? t('admin.typePost') || 'Post' :
                                  (selectedReport as any).content_type === 'comment' ? t('admin.typeComment') || 'Comment' :
                                    (selectedReport as any).content_type === 'chatroom' ? t('admin.typeChatroom') || 'Chatroom' :
                                      (selectedReport as any).content_type === 'chatroom_background' ? t('admin.typeChatroomBackground') || 'Chatroom Background' :
                                        (selectedReport as any).content_type === 'chatroom_picture' ? t('admin.typeChatroomPicture') || 'Chatroom Picture' :
                                          (selectedReport as any).content_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.status') || 'Status'}
                      </label>
                      <p className="theme-text-primary">{getReportStatusConfig(selectedReport.status).label}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.reportedBy') || 'Reported by'}
                      </label>
                      <p className="theme-text-primary">{selectedReport.reporter_username || 'Unknown'}</p>
                    </div>

                    {selectedReport.reported_username && (
                      <div>
                        <label className="text-sm font-medium theme-text-muted">
                          {t('admin.reportedUser') || 'Reported User'}
                        </label>
                        <div className="flex items-center justify-between">
                          <p className="theme-text-primary">{selectedReport.reported_username}</p>
                          {selectedReport.reported_user_id && (
                            <button
                              onClick={() => handleShowMessageHistory(selectedReport.reported_user_id!)}
                              className="px-3 py-1 text-sm btn btn-secondary"
                            >
                              {t('admin.viewMessageHistory') || 'View Message History'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.reason') || 'Reason'}
                      </label>
                      <p className="theme-text-primary">{getReportReasonLabel(selectedReport.reason)}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.description') || 'Description'}
                      </label>
                      <p className="theme-text-primary whitespace-pre-wrap">{selectedReport.description}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium theme-text-muted">
                        {t('admin.reportedAt') || 'Reported at'}
                      </label>
                      <p className="theme-text-primary">
                        {new Date(selectedReport.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Content-specific information */}
                    {selectedReport.content_data && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-semibold theme-text-primary mb-3">
                          {t('admin.reportedContent') || 'Reported Content'}
                        </h4>
                        {selectedReport.content_type === 'message' && selectedReport.content_data.content && (
                          <div className="space-y-2">
                            <p className="theme-text-primary whitespace-pre-wrap">{selectedReport.content_data.content}</p>
                            {selectedReport.content_data.attachments && selectedReport.content_data.attachments.length > 0 && (
                              <div className="mt-3">
                                <label className="text-xs font-medium theme-text-muted">
                                  {t('admin.attachments') || 'Attachments'} ({selectedReport.content_data.attachments.length})
                                </label>
                                <div className="mt-2 space-y-2">
                                  {selectedReport.content_data.attachments.map((attachment: any, idx: number) => {
                                    if (attachment.type === 'image') {
                                      return (
                                        <img
                                          key={idx}
                                          src={attachment.url}
                                          alt={attachment.filename || 'Image'}
                                          className="max-w-full max-h-64 rounded-lg cursor-pointer"
                                          onClick={() => window.open(attachment.url, '_blank')}
                                        />
                                      );
                                    } else if (attachment.type === 'video') {
                                      return (
                                        <video
                                          key={idx}
                                          src={attachment.url}
                                          controls
                                          className="max-w-full max-h-64 rounded-lg"
                                        />
                                      );
                                    } else if (attachment.type === 'gif') {
                                      return (
                                        <img
                                          key={idx}
                                          src={attachment.url || attachment.gif_url}
                                          alt="GIF"
                                          className="max-w-full max-h-64 rounded-lg"
                                        />
                                      );
                                    } else {
                                      return (
                                        <div key={idx} className="p-2 bg-gray-200 dark:bg-gray-600 rounded">
                                          <a href={attachment.url} download className="text-blue-600 dark:text-blue-400 hover:underline">
                                            {attachment.filename || 'File'} ({(attachment.size / 1024).toFixed(2)} KB)
                                          </a>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedReport.content_type === 'post' && (
                          <div className="space-y-2">
                            <p className="font-semibold theme-text-primary">{selectedReport.content_data.title}</p>
                            <p className="theme-text-primary whitespace-pre-wrap">{selectedReport.content_data.content}</p>
                          </div>
                        )}
                        {selectedReport.content_type === 'comment' && (
                          <p className="theme-text-primary whitespace-pre-wrap">{selectedReport.content_data.content}</p>
                        )}
                        {selectedReport.content_type === 'chatroom' && (
                          <div className="space-y-2">
                            <p className="font-semibold theme-text-primary">{selectedReport.content_data.name}</p>
                            <p className="theme-text-primary">{selectedReport.content_data.description}</p>
                            {selectedReport.content_data.owner && (
                              <p className="text-xs theme-text-muted">
                                {t('admin.owner') || 'Owner'}: {selectedReport.content_data.owner.username || selectedReport.content_data.owner_username}
                              </p>
                            )}
                            {selectedReport.content_data.moderators && selectedReport.content_data.moderators.length > 0 && (
                              <p className="text-xs theme-text-muted">
                                {t('admin.moderators') || 'Moderators'}: {selectedReport.content_data.moderators.map((m: any) => m.username || m).join(', ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Attached Messages */}
                    {(selectedReport as any).attached_messages_data && (selectedReport as any).attached_messages_data.length > 0 && (
                      <div className="mt-4">
                        <label className="text-sm font-medium theme-text-muted mb-2 block">
                          {t('admin.attachedMessages') || 'Attached Messages'} ({(selectedReport as any).attached_messages_data.length})
                        </label>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {(selectedReport as any).attached_messages_data.map((msg: any, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border theme-border">
                              <div className="text-xs theme-text-muted mb-2">
                                {new Date(msg.created_at).toLocaleString()}
                              </div>
                              {msg.content && (
                                <p className="theme-text-primary whitespace-pre-wrap mb-2">{msg.content}</p>
                              )}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {msg.attachments.map((attachment: any, attIdx: number) => {
                                    if (attachment.type === 'image') {
                                      return (
                                        <img
                                          key={attIdx}
                                          src={attachment.url}
                                          alt={attachment.filename || 'Image'}
                                          className="max-w-full max-h-48 rounded-lg cursor-pointer"
                                          onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename || 'Image' })}
                                        />
                                      );
                                    } else if (attachment.type === 'video') {
                                      return (
                                        <VideoPlayer
                                          key={attIdx}
                                          src={attachment.url}
                                          filename={attachment.filename || 'Video'}
                                          className="max-w-full max-h-48"
                                        />
                                      );
                                    } else if (attachment.type === 'gif' || attachment.gif_url) {
                                      return (
                                        <img
                                          key={attIdx}
                                          src={attachment.url || attachment.gif_url}
                                          alt="GIF"
                                          className="max-w-full max-h-48 rounded-lg"
                                        />
                                      );
                                    } else {
                                      return (
                                        <div key={attIdx} className="p-2 bg-gray-200 dark:bg-gray-600 rounded">
                                          <a href={attachment.url} download className="text-blue-600 dark:text-blue-400 hover:underline">
                                            {attachment.filename || 'File'} ({(attachment.size / 1024).toFixed(2)} KB)
                                          </a>
                                        </div>
                                      );
                                    }
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    {/* Reopen button for resolved reports */}
                    {selectedReport.status === 'resolved' && (
                      <button
                        onClick={() => handleReopenReport(selectedReport.id)}
                        className="w-full px-4 py-2 btn btn-secondary"
                      >
                        {t('admin.reopenReport') || 'Reopen Report'}
                      </button>
                    )}

                    {/* Reopen button and Mark as Resolved for dismissed/reviewed reports */}
                    {(selectedReport.status === 'dismissed' || selectedReport.status === 'reviewed') && (
                      <>
                        <button
                          onClick={() => handleReopenReport(selectedReport.id)}
                          className="w-full px-4 py-2 btn btn-secondary"
                        >
                          {t('admin.reopenReport') || 'Reopen Report'}
                        </button>
                        <button
                          onClick={() => handleResolveReport(selectedReport.id)}
                          className="w-full px-4 py-2 btn btn-primary"
                        >
                          {t('admin.markAsResolved') || 'Mark as Resolved'}
                        </button>
                      </>
                    )}

                    {/* Actions for pending reports */}
                    {selectedReport.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleDismiss(selectedReport.id)}
                          className="w-full px-4 py-2 btn btn-ghost"
                        >
                          {t('admin.dismissReport') || 'Dismiss Report'}
                        </button>
                        {selectedReport.reported_user_id && (
                          <>
                            <button
                              onClick={() =>
                                handleWarnUser(
                                  selectedReport.id,
                                  selectedReport.reported_user_id!,
                                  selectedReport.reported_username || 'Unknown'
                                )
                              }
                              className="w-full px-4 py-2 btn btn-secondary"
                            >
                              {t('admin.warnUser') || 'Warn User'}
                            </button>
                            <button
                              onClick={() =>
                                handleBanUser(
                                  selectedReport.reported_user_id!,
                                  selectedReport.reported_username || 'Unknown'
                                )
                              }
                              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                              {t('admin.banUser') || 'Ban User'}
                            </button>
                          </>
                        )}
                        {selectedReport.content_id && (
                          <button
                            onClick={() => handleResolve(selectedReport.id, 'delete_content')}
                            className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                          >
                            {t('admin.deleteContent') || 'Delete Content'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && reports.length > 0 && (
            <div className="p-4 border-t theme-border flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 btn btn-ghost disabled:opacity-50"
              >
                {t('common.previous') || 'Previous'}
              </button>
              <span className="text-sm theme-text-muted">
                {t('common.page') || 'Page'} {page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="px-4 py-2 btn btn-ghost disabled:opacity-50"
              >
                {t('common.next') || 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showBanDialog && (
        <BanUserDialog
          userId={banUserId}
          username={banUsername}
          onClose={() => {
            setShowBanDialog(false);
            fetchReports();
          }}
        />
      )}

      {showWarnDialog && (
        <WarnUserDialog
          reportId={warnReportId}
          userId={warnUserId}
          username={warnUsername}
          onClose={() => {
            setShowWarnDialog(false);
            setWarnReportId('');
            setWarnUserId('');
            setWarnUsername('');
          }}
          onSuccess={() => {
            fetchReports();
            setSelectedReport(null);
          }}
        />
      )}

      {/* Message History Modal */}
      {showMessageHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="theme-bg-secondary rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b theme-border flex items-center justify-between">
              <h2 className="text-2xl font-semibold theme-text-primary">
                {t('admin.messageHistory') || 'Message History'}
              </h2>
              <button
                onClick={() => {
                  setShowMessageHistory(false);
                  setMessageHistory([]);
                }}
                className="p-1 rounded-lg hover:theme-bg-tertiary transition-colors"
              >
                <svg className="w-6 h-6 theme-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : messageHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 theme-text-muted">
                  <p>{t('admin.noMessages') || 'No messages found'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messageHistory.map((message) => (
                    <div
                      key={message.id}
                      className="p-4 theme-bg-primary rounded-lg border theme-border"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs theme-text-muted">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                        {message.topic_id && (
                          <span className="text-xs theme-text-muted">
                            Topic: {message.topic_id.substring(0, 8)}...
                          </span>
                        )}
                        {message.chat_room_id && (
                          <span className="text-xs theme-text-muted">
                            Chat Room: {message.chat_room_id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      {message.gif_url ? (
                        <img src={message.gif_url} alt="GIF" className="max-w-xs rounded" />
                      ) : (
                        <p className="theme-text-primary whitespace-pre-wrap">{message.content}</p>
                      )}
                      {/* Display attachments in message history */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.attachments.map((attachment: any, attIdx: number) => {
                            if (attachment.type === 'image') {
                              return (
                                <img
                                  key={attIdx}
                                  src={attachment.url}
                                  alt={attachment.filename || 'Image'}
                                  className="max-w-full max-h-48 rounded-lg cursor-pointer"
                                  onClick={() => setViewingImage({ url: attachment.url, filename: attachment.filename || 'Image' })}
                                />
                              );
                            } else if (attachment.type === 'video') {
                              return (
                                <VideoPlayer
                                  key={attIdx}
                                  src={attachment.url}
                                  filename={attachment.filename || 'Video'}
                                  className="max-w-full max-h-48"
                                />
                              );
                            } else if (attachment.type === 'gif' || attachment.gif_url) {
                              return (
                                <img
                                  key={attIdx}
                                  src={attachment.url || attachment.gif_url}
                                  alt="GIF"
                                  className="max-w-full max-h-48 rounded-lg"
                                />
                              );
                            } else {
                              return (
                                <div key={attIdx} className="p-2 bg-gray-200 dark:bg-gray-600 rounded">
                                  <a href={attachment.url} download className="text-blue-600 dark:text-blue-400 hover:underline">
                                    {attachment.filename || 'File'} ({(attachment.size / 1024).toFixed(2)} KB)
                                  </a>
                                </div>
                              );
                            }
                          })}
                        </div>
                      )}
                      {message.is_anonymous && (
                        <span className="text-xs theme-text-muted mt-2 block">
                          {t('chat.anonymous') || 'Anonymous'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage.url}
          filename={viewingImage.filename}
          onClose={() => setViewingImage(null)}
        />
      )}
    </>
  );
};

export default ReportsModal;
