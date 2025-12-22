import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import RegistrationWizard from '@/components/Auth/Registration/RegistrationWizard';
import LanguageToggle from '@/components/UI/LanguageToggle';
import ThemeToggle from '@/components/UI/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';

const RegisterPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <>
      <Head>
        <title>{`${t('registration.title')} - ${t('common.appName')}`}</title>
        <meta name="description" content={t('registration.metaDescription')} />
        <link rel="icon" type="image/png" href="https://i.postimg.cc/FY5shL9w/chat.png" />
      </Head>

      {/* Fixed Header with Controls */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4">
        <div className="flex justify-between items-center">
          <Link href="/about" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <img
              src="https://i.postimg.cc/FY5shL9w/chat.png"
              alt="TopicsFlow Logo"
              className="h-10 w-10"
            />
            <span className="text-xl font-bold theme-text-primary">
              {t('common.appName')}
            </span>
          </Link>
          <div className="flex items-center space-x-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Registration Wizard */}
      <RegistrationWizard />
    </>
  );
};

export default RegisterPage;
