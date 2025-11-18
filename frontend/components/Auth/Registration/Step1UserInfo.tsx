import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { RegistrationData } from './RegistrationWizard';

interface Step1Props {
  data: RegistrationData;
  updateData: (data: Partial<RegistrationData>) => void;
  onNext: () => void;
}

const Step1UserInfo: React.FC<Step1Props> = ({ data, updateData, onNext }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: data.username || '',
    email: data.email || '',
  });
  const [errors, setErrors] = useState<{ username?: string; email?: string }>({});

  const validateForm = () => {
    const newErrors: { username?: string; email?: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = t('errors.requiredField');
    } else if (formData.username.length < 3) {
      newErrors.username = t('errors.minLength', { min: 3 });
    }

    if (!formData.email.trim()) {
      newErrors.email = t('errors.requiredField');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('errors.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register-passwordless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        updateData({
          username: formData.username,
          email: formData.email,
          userId: result.user_id,
        });
        toast.success(t('registration.emailSent'));
        onNext();
      } else {
        const errorMessage = result.error || t('errors.generic');
        if (errorMessage.includes('username')) {
          setErrors({ username: t('errors.usernameTaken') });
        } else if (errorMessage.includes('email')) {
          setErrors({ email: t('errors.emailTaken') });
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(t('errors.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Username Field */}
      <div>
        <label htmlFor="username" className="block text-sm font-medium theme-text-primary mb-2">
          {t('auth.username')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className={`w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2
            ${errors.username ? 'border-red-500' : 'theme-border'}
            focus:outline-none focus:border-blue-500 transition-colors`}
          placeholder={t('auth.username')}
          disabled={loading}
          autoFocus
        />
        {errors.username && (
          <p className="mt-1 text-sm text-red-500">{errors.username}</p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium theme-text-primary mb-2">
          {t('auth.email')} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={`w-full px-4 py-3 rounded-lg theme-bg-primary theme-text-primary border-2
            ${errors.email ? 'border-red-500' : 'theme-border'}
            focus:outline-none focus:border-blue-500 transition-colors`}
          placeholder={t('auth.email')}
          disabled={loading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 theme-bg-primary rounded-lg border theme-border">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm theme-text-secondary space-y-1">
            <p><strong className="theme-text-primary">{t('common.note')}:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t('registration.noPasswordRequired')}</li>
              <li>{t('registration.authenticatorRequired')}</li>
              <li>{t('registration.emailVerificationRequired')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
          text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{t('common.loading')}</span>
          </>
        ) : (
          <span>{t('common.next')}</span>
        )}
      </button>

      {/* Sign In Link */}
      <div className="text-center text-sm theme-text-secondary">
        {t('auth.alreadyHaveAccount')}{' '}
        <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          {t('auth.signIn')}
        </a>
      </div>
    </form>
  );
};

export default Step1UserInfo;
