/**
 * Frontend Tests for NotificationCenter Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import NotificationCenter from '@/components/UI/NotificationCenter';
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

describe('NotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render notification bell icon', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <NotificationCenter />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const bellButton = screen.getByLabelText(/notifications/i);
    expect(bellButton).toBeInTheDocument();
  });

  it('should open notification popup when clicked', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <NotificationCenter />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    const bellButton = screen.getByLabelText(/notifications/i);
    fireEvent.click(bellButton);

    expect(screen.getByText(/notifications/i)).toBeInTheDocument();
  });

  it('should listen for private message events', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <NotificationCenter />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    expect(mockSocket.on).toHaveBeenCalledWith('new_private_message', expect.any(Function));
  });

  it('should listen for mention events', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, loading: false } as any}>
        <SocketContext.Provider value={{ socket: mockSocket, connected: true } as any}>
          <NotificationCenter />
        </SocketContext.Provider>
      </AuthContext.Provider>
    );

    expect(mockSocket.on).toHaveBeenCalledWith('user_mentioned', expect.any(Function));
  });
});

