import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout/Layout';
import ChatRoomContainer from '@/components/ChatRoom/ChatRoomContainer';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { api, API_ENDPOINTS } from '@/utils/api';
import { toast } from 'react-hot-toast';

interface ChatRoom {
    id: string;
    name: string;
    description: string;
    topic_id: string;
    owner_id: string;
    owner?: {
      id: string;
      username: string;
    };
    tags: string[];
    is_public: boolean;
    member_count: number;
    message_count: number;
    last_activity: string;
    user_is_member?: boolean;
    background_picture?: string;
}

export default function ChatRoomPage() {
    const router = useRouter();
    const { id } = router.query;
    const [room, setRoom] = useState<ChatRoom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (id && typeof id === 'string') {
            fetchRoom(id);
        } else if (router.isReady && !id) {
             // If ready but no ID? 404
             setError(true);
             setLoading(false);
        }
    }, [id, router.isReady]);

    const fetchRoom = async (roomId: string) => {
        try {
            setLoading(true);
            const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET(roomId));
            if (response.data.success) {
                setRoom(response.data.data);
            } else {
                setError(true);
            }
        } catch (error) {
            console.error('Error fetching chat room:', error);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    if (error) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <h1 className="text-2xl font-bold mb-4 theme-text-primary">Chat Room Not Found</h1>
                    <p className="theme-text-secondary mb-6">The chat room you are looking for does not exist or you do not have permission to view it.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </Layout>
        );
    }

    if (loading || !room) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <LoadingSpinner size="lg" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="h-[calc(100vh-64px)] flex flex-col">
                 <ChatRoomContainer
                    room={room}
                    onBack={() => router.push('/')}
                 />
            </div>
        </Layout>
    );
}
