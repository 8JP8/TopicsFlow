import React, { useState, useEffect, useRef } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import Avatar from '@/components/UI/Avatar';

interface User {
  id: string;
  username: string;
}

interface MentionAutocompleteProps {
  chatRoomId: string;
  topicId: string;
  onSelect: (user: User) => void;
  position: { x: number; y: number };
  searchQuery: string;
}

/**
 * MentionAutocomplete Component
 * 
 * Displays a dropdown list of users that can be mentioned.
 * Triggered when typing @ in message input.
 * 
 * Usage:
 * {showMentionAutocomplete && (
 *   <MentionAutocomplete
 *     chatRoomId={chatRoomId}
 *     topicId={topicId}
 *     onSelect={handleMentionSelect}
 *     position={autocompletePosition}
 *     searchQuery={mentionQuery}
 *   />
 * )}
 */
const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  chatRoomId,
  topicId,
  onSelect,
  position,
  searchQuery,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUsers();
  }, [chatRoomId]);

  useEffect(() => {
    // Reset selection when search query changes
    setSelectedIndex(0);
  }, [searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Fetch users in this chat room
      const response = await api.get(API_ENDPOINTS.CHAT_ROOMS.GET_MEMBERS(chatRoomId));
      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users for mentions:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (user: User) => {
    onSelect(user);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === 'Enter' && filteredUsers.length > 0) {
      e.preventDefault();
      handleSelect(filteredUsers[selectedIndex]);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredUsers]);

  if (loading) {
    return (
      <div
        className="absolute theme-bg-secondary border theme-border rounded-lg shadow-lg p-4"
        style={{ left: position.x, top: position.y, zIndex: 9999 }}
      >
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return null; // Don't show dropdown if no matches
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute theme-bg-secondary border theme-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
      style={{ left: position.x, top: position.y, zIndex: 9999, width: '200px' }}
    >
      {filteredUsers.map((user, index) => (
        <div
          key={user.id}
          onClick={() => handleSelect(user)}
          className={`
            px-4 py-2 cursor-pointer transition-colors
            ${index === selectedIndex 
              ? 'theme-bg-tertiary theme-text-primary' 
              : 'hover:theme-bg-tertiary theme-text-primary'
            }
          `}
        >
          <div className="flex items-center space-x-2">
            <Avatar
              userId={user.id}
              username={user.username}
              size="sm"
            />
            <span className="font-medium">@{user.username}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MentionAutocomplete;
