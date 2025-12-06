import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api, API_ENDPOINTS } from '@/utils/api';
import Layout from '@/components/Layout/Layout';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface AnonymousIdentity {
  id: string;
  topic_id: string;
  topic_title: string;
  identity_name: string;
  created_at: string;
  message_count: number;
}

const AnonymousIdentities: React.FC = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [identities, setIdentities] = useState<AnonymousIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadIdentities();
    }
  }, [user, authLoading, router]);

  const loadIdentities = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.USERS.ANONYMOUS_IDENTITIES);

      if (response.data.success) {
        setIdentities(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load identities:', error);
      toast.error(t('anonymousIdentities.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIdentity = async (topicId: string) => {
    if (!confirm(t('anonymousIdentities.deleteConfirm'))) {
      return;
    }

    setDeletingId(topicId);

    try {
      const response = await api.delete(API_ENDPOINTS.USERS.DELETE_ANONYMOUS_IDENTITY(topicId));

      if (response.data.success) {
        toast.success(t('anonymousIdentities.deleteSuccess'));
        // Remove from local state
        setIdentities(prev => prev.filter(identity => identity.topic_id !== topicId));
      } else {
        toast.error(t('anonymousIdentities.deleteFailed'));
      }
    } catch (error) {
      console.error('Failed to delete identity:', error);
      toast.error(t('anonymousIdentities.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center text-sm theme-text-secondary hover:theme-text-primary mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('anonymousIdentities.backToSettings')}
          </button>
          <h1 className="text-3xl font-bold theme-text-primary mb-2">{t('anonymousIdentities.title')}</h1>
          <p className="theme-text-secondary">
            {t('anonymousIdentities.subtitle')}
          </p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">{t('anonymousIdentities.infoTitle')}</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('anonymousIdentities.infoDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Identities List */}
        <div className="theme-bg-secondary rounded-lg shadow-sm overflow-hidden">
          {identities.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="text-lg font-medium theme-text-primary mb-2">{t('anonymousIdentities.noIdentities')}</h3>
              <p className="theme-text-secondary">
                {t('anonymousIdentities.noIdentitiesDesc')}
              </p>
            </div>
          ) : (
            <div className="divide-y theme-border">
              {identities.map((identity) => (
                <div key={identity.id} className="p-6 hover:theme-bg-tertiary transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mr-3">
                          <span className="text-white font-semibold text-sm">
                            {identity.identity_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold theme-text-primary">{identity.identity_name || 'Unknown'}</h3>
                          <p className="text-sm theme-text-secondary">
                            in <span className="font-medium">{identity.topic_title || 'Unknown Topic'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-sm theme-text-muted mt-3">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          {identity.message_count} {t('anonymousIdentities.messageCount')}
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {t('anonymousIdentities.createdAt')} {formatDate(identity.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => router.push(`/?topic=${identity.topic_id}`)}
                        className="px-3 py-2 btn btn-ghost text-sm"
                        title={t('anonymousIdentities.viewTopic')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteIdentity(identity.topic_id)}
                        disabled={deletingId === identity.topic_id}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors text-sm disabled:opacity-50"
                        title={t('anonymousIdentities.delete')}
                      >
                        {deletingId === identity.topic_id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warning */}
        {identities.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">{t('anonymousIdentities.warningTitle')}</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {t('anonymousIdentities.warningDesc')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AnonymousIdentities;
