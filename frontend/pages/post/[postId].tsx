import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout/Layout';
import PostDetail from '@/components/Post/PostDetail';

const PostPage: React.FC = () => {
  const router = useRouter();
  const { postId } = router.query;

  if (!postId || typeof postId !== 'string') {
    return (
      <Layout>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>Invalid post ID</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PostDetail postId={postId} />
    </Layout>
  );
};

export default PostPage;











