import { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

export default function PostRedirect() {
    const router = useRouter();
    const { id } = router.query;

    useEffect(() => {
        if (id) {
            router.replace(`/?postId=${id}`);
        }
    }, [id, router]);

    return (
        <div className="min-h-screen flex items-center justify-center theme-bg-primary">
            <LoadingSpinner size="lg" />
        </div>
    );
}
