import { useState, useEffect } from 'react';
import { api, API_ENDPOINTS } from '@/utils/api';

interface UserProfile {
  id: string;
  username: string;
  profile_picture?: string;
  banner?: string;
}

const profileCache = new Map<string, UserProfile>();
const pendingRequests = new Map<string, Promise<UserProfile | null>>();

export const useUserProfile = (userId?: string | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || typeof userId !== 'string' || userId.length < 10) {
      setProfile(null);
      return;
    }

    // Check cache first
    const cached = profileCache.get(userId);
    if (cached) {
      setProfile(cached);
      return;
    }

    // Fetch from API
    setLoading(true);

    // Use the deduplicated refreshUserProfile
    refreshUserProfile(userId)
      .then(profile => {
        if (profile) {
          setProfile(profile);
        }
      })
      .catch(error => {
        console.error('Failed to fetch user profile:', error);
        // Set a default profile with username from cache if available
        const cached = profileCache.get(userId);
        if (cached) {
          setProfile(cached);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { profile, loading };
};

// Helper function to normalize profile picture format (add data URI prefix if needed)
export const normalizeProfilePicture = (profilePicture: string | undefined | null): string | undefined => {
  if (!profilePicture) return undefined;

  // If it already has a data URI prefix, return as is
  if (profilePicture.startsWith('data:')) {
    return profilePicture;
  }

  // If it's just base64, add the data URI prefix
  // Assume JPEG format (backend compression returns JPEG)
  return `data:image/jpeg;base64,${profilePicture}`;
};

// Helper function to get profile picture from cache
// If userId matches currentUserId from AuthContext, it will use that instead
export const getUserProfilePicture = (userId: string, currentUser?: { id?: string; profile_picture?: string }): string | undefined => {
  let picture: string | undefined;

  // If this is the current user and we have their profile picture from AuthContext, use that
  if (currentUser && currentUser.id === userId && currentUser.profile_picture) {
    picture = currentUser.profile_picture;
  } else {
    // Otherwise, get from cache
    picture = profileCache.get(userId)?.profile_picture;
  }

  // Normalize the format (add data URI prefix if needed)
  return normalizeProfilePicture(picture);
};

// Helper function to get username from cache
export const getUserUsername = (userId: string): string | undefined => {
  return profileCache.get(userId)?.username;
};

// Helper function to clear profile cache for a user
export const clearUserProfileCache = (userId: string) => {
  profileCache.delete(userId);
};

// Helper function to update profile cache
export const updateUserProfileCache = (userId: string, profileData: UserProfile) => {
  profileCache.set(userId, profileData);
};

// Helper function to force refresh a user's profile from API
// Automatically deduplicates concurrent requests for the same userId
export const refreshUserProfile = async (userId: string, skipToasts: boolean = false): Promise<UserProfile | null> => {
  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    return null;
  }

  // Check if there's already a pending request for this user
  const pending = pendingRequests.get(userId);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async (): Promise<UserProfile | null> => {
    try {
      const config = skipToasts ? { headers: { 'X-Skip-Toasts': 'true' } } : {};
      const response = await api.get(API_ENDPOINTS.USERS.GET(userId), config);

      if (response.data.success) {
        const userData = response.data.data;
        const profileData: UserProfile = {
          id: userData.id,
          username: userData.username,
          profile_picture: userData.profile_picture, // Store as-is (may be base64 without prefix)
          banner: userData.banner, // Store as-is (may be base64 without prefix)
        };
        profileCache.set(userId, profileData);
        console.log('Refreshed user profile from API:', userId, 'has picture:', !!profileData.profile_picture);
        return profileData;
      }
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    } finally {
      // Clean up pending request
      pendingRequests.delete(userId);
    }
    return null;
  })();

  pendingRequests.set(userId, fetchPromise);
  return fetchPromise;
};


