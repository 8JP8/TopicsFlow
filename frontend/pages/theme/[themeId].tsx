import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout/Layout';
import ThemeView from '@/components/Theme/ThemeView';

const ThemePage: React.FC = () => {
  const router = useRouter();
  const { themeId } = router.query;

  if (!themeId || typeof themeId !== 'string') {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Invalid theme ID</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <ThemeView themeId={themeId} />
    </Layout>
  );
};

export default ThemePage;


