import React from 'react';
import ClickableUsername from './ClickableUsername';

interface Message {
  id: string;
  user_id: string;
  sender_username?: string;
  display_name?: string;
  content: string;
  is_anonymous?: boolean;
  anonymous_identity?: string;
  mentions?: string[]; // Array of user IDs
  created_at: string;
}

interface MessageWithClickableElementsProps {
  message: Message;
  usersMap?: Map<string, { id: string; username: string }>; // Map of user IDs to user objects
}

/**
 * MessageWithClickableElements Component
 * 
 * Displays a chat message with:
 * - Clickable username (shows banner/context menu)
 * - Clickable mentions (shows banner/context menu)
 * - Proper rendering of message content
 * 
 * Usage:
 * <MessageWithClickableElements
 *   message={message}
 *   usersMap={usersMap}
 * />
 */
const MessageWithClickableElements: React.FC<MessageWithClickableElementsProps> = ({
  message,
  usersMap = new Map(),
}) => {

  /**
   * Parse message content and convert @mentions to clickable elements
   */
  const renderMessageContent = (content: string) => {
    // Regular expression to match @username
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const matchIndex = match.index;

      // Add text before mention
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, matchIndex)}
          </span>
        );
      }

      // Find user by username
      let mentionedUser = null;
      for (const [userId, user] of Array.from(usersMap.entries())) {
        if (user.username.toLowerCase() === username.toLowerCase()) {
          mentionedUser = { id: userId, username: user.username };
          break;
        }
      }

      // Add clickable mention
      if (mentionedUser) {
        parts.push(
          <ClickableUsername
            key={`mention-${matchIndex}`}
            userId={mentionedUser.id}
            username={mentionedUser.username}
            className="text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-1 rounded font-medium"
          >
            @{mentionedUser.username}
          </ClickableUsername>
        );
      } else {
        // Username not found, render as plain text
        parts.push(
          <span key={`mention-${matchIndex}`} className="theme-text-muted">
            @{username}
          </span>
        );
      }

      lastIndex = mentionRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
  };

  // Determine username and if anonymous
  const isAnonymous = message.is_anonymous || false;
  const displayUsername = isAnonymous
    ? (message.anonymous_identity || 'Anonymous')
    : (message.display_name || message.sender_username || 'Unknown User');

  return (
    <div className="flex flex-col space-y-1">
      {/* Message Header */}
      <div className="flex items-center space-x-2">
        {/* Clickable Username */}
        <ClickableUsername
          userId={message.user_id}
          username={displayUsername}
          isAnonymous={isAnonymous}
          className="text-sm font-semibold"
        >
          {displayUsername}
        </ClickableUsername>

        {/* Timestamp */}
        <span className="text-xs theme-text-muted">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Anonymous Badge */}
        {isAnonymous && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 theme-text-muted">
            Anonymous
          </span>
        )}
      </div>

      {/* Message Content with Clickable Mentions */}
      <div className="text-sm theme-text-primary break-words">
        {renderMessageContent(message.content)}
      </div>
    </div>
  );
};

export default MessageWithClickableElements;
