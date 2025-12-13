import React, { useState, useEffect } from 'react';
import { getUserProfilePicture, normalizeProfilePicture, refreshUserProfile } from '@/hooks/useUserProfile';
import { useAuth } from '@/contexts/AuthContext';
import { getUserColorClass } from '@/utils/colorUtils';

interface AvatarProps {
  userId?: string;
  username?: string;
  profilePicture?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  onClick?: (e?: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
  '2xl': 'w-20 h-20 text-2xl',
};

const Avatar: React.FC<AvatarProps> = ({
  userId,
  username,
  profilePicture: providedProfilePicture,
  size = 'md',
  className = '',
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { user: currentUser } = useAuth();
  const [fetchedProfilePicture, setFetchedProfilePicture] = useState<string | undefined>(undefined);

  // If userId is provided but no profilePicture, fetch it
  useEffect(() => {
    if (userId && !providedProfilePicture) {
      // First try to get from cache
      const picture = getUserProfilePicture(userId, currentUser || undefined);
      if (picture) {
        setFetchedProfilePicture(picture);
      } else {
        // If not in cache, fetch from API
        refreshUserProfile(userId).then(profile => {
          if (profile?.profile_picture) {
            setFetchedProfilePicture(normalizeProfilePicture(profile.profile_picture));
          }
        }).catch(() => {
          // Ignore errors, will show initial
        });
      }
    } else {
      setFetchedProfilePicture(undefined);
    }
  }, [userId, providedProfilePicture, currentUser]);

  const sizeClass = sizeClasses[size];
  const displayName = username || '?';
  const initial = displayName.charAt(0).toUpperCase();

  // Use provided profile picture, or fetched one, or nothing
  const profilePicture = providedProfilePicture || fetchedProfilePicture;
  const normalizedPicture = normalizeProfilePicture(profilePicture);

  // Get dynamic background color class based on user identifier
  // Prioritize userId for consistency
  const bgColorClass = getUserColorClass(userId || username || '?');

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 relative overflow-hidden ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Random color background - always visible, even behind images */}
      <div className={`absolute inset-0 ${bgColorClass} rounded-full`} style={{ zIndex: 0 }} />

      {normalizedPicture ? (
        <img
          src={normalizedPicture}
          alt={displayName}
          className="relative w-full h-full rounded-full object-cover"
          style={{ zIndex: 10, position: 'relative' }}
          onError={(e) => {
            // If image fails to load, hide it and show initial
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="relative" style={{ zIndex: 10 }}>{initial}</span>
      )}
    </div>
  );
};

export default Avatar;
