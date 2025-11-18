/**
 * Frontend Tests for ChatContainer Component
 * 
 * These tests verify message sending, receiving, and real-time updates.
 * Run with: npm test
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import ChatContainer from '@/components/Chat/ChatContainer';
import { SocketContext } from '@/contexts/SocketContext';
import { AuthContext } from '@/contexts/AuthContext';

// Mock socket
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  id: 'test-socket-id',
};

// Mock user
const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
};

// Mock topic
const mockTopic = {
  id: 'test-topic-id',
  title: 'Test Topic',
  description: 'Test Description',
  settings: {
    allow_anonymous: true,
    require_approval: false,
  },
};

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render topic title and description', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <ChatContainer
            topic={mockTopic}
            messages={[]}
            onMessageReceived={jest.fn()}
            onBackToTopics={jest.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Test Topic')).toBeInTheDocument();
  });

  it('should send message when form is submitted', async () => {
    const onMessageReceived = jest.fn();
    const sendMessage = jest.fn();

    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ 
          socket: mockSocket, 
          connected: true,
          sendMessage,
        } as any}>
          <ChatContainer
            topic={mockTopic}
            messages={[]}
            onMessageReceived={onMessageReceived}
            onBackToTopics={jest.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const input = screen.getByPlaceholderText(/message as/i);
    const sendButton = screen.getByText(/send/i);

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        'test-topic-id',
        'Test message',
        'text',
        false,
        undefined
      );
    });
  });

  it('should display messages', () => {
    const messages = [
      {
        id: 'msg-1',
        content: 'Hello world',
        message_type: 'text',
        created_at: new Date().toISOString(),
        display_name: 'Test User',
        is_anonymous: false,
        can_delete: false,
        topic_id: 'test-topic-id',
      },
    ];

    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <ChatContainer
            topic={mockTopic}
            messages={messages}
            onMessageReceived={jest.fn()}
            onBackToTopics={jest.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('should display GIFs in messages', () => {
    const messages = [
      {
        id: 'msg-1',
        content: '',
        message_type: 'gif',
        created_at: new Date().toISOString(),
        display_name: 'Test User',
        is_anonymous: false,
        can_delete: false,
        topic_id: 'test-topic-id',
        gif_url: 'https://example.com/gif.gif',
      },
    ];

    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <ChatContainer
            topic={mockTopic}
            messages={messages}
            onMessageReceived={jest.fn()}
            onBackToTopics={jest.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const gifImage = screen.getByAltText('GIF');
    expect(gifImage).toBeInTheDocument();
    expect(gifImage).toHaveAttribute('src', 'https://example.com/gif.gif');
  });

  it('should highlight mentions in messages', () => {
    const messages = [
      {
        id: 'msg-1',
        content: 'Hello @testuser how are you?',
        message_type: 'text',
        created_at: new Date().toISOString(),
        display_name: 'Test User',
        is_anonymous: false,
        can_delete: false,
        topic_id: 'test-topic-id',
      },
    ];

    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <ChatContainer
            topic={mockTopic}
            messages={messages}
            onMessageReceived={jest.fn()}
            onBackToTopics={jest.fn()}
          />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const mention = screen.getByText('@testuser');
    expect(mention).toHaveClass('font-semibold', 'text-blue-600');
  });
});

