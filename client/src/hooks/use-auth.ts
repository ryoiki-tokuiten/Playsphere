import { useState, useEffect } from 'react';
import { User } from '@shared/schema';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    // Load user from localStorage on mount
    const checkUserAuth = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setAuthState({
          user: parsedUser,
          isAdmin: !!parsedUser.isAdmin,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkUserAuth();

    // Listen for storage changes
    window.addEventListener('storage', checkUserAuth);
    return () => window.removeEventListener('storage', checkUserAuth);
  }, []);

  // Update lastActive timestamp periodically when user is logged in
  useEffect(() => {
    if (!authState.user?.id) return;

    // Function to update lastActive
    const updateLastActive = async () => {
      try {
        const response = await fetch(`/api/users/${authState.user?.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lastActive: new Date(),
          }),
        });

        if (response.ok) {
          const updatedUser = await response.json();
          // Update local storage with the new user data
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setAuthState({
            user: updatedUser,
            isAdmin: !!updatedUser.isAdmin,
            isAuthenticated: true,
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Error updating lastActive:', error);
      }
    };

    // Update immediately on mount
    updateLastActive();

    // Then update every minute
    const interval = setInterval(updateLastActive, 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [authState.user?.id]);

  const login = (userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setAuthState({
      user: userData,
      isAdmin: !!userData.isAdmin,
      isAuthenticated: true,
      isLoading: false
    });
  };

  const logout = () => {
    localStorage.removeItem('user');
    setAuthState({
      user: null,
      isAdmin: false,
      isAuthenticated: false,
      isLoading: false
    });
  };

  return {
    ...authState,
    login,
    logout
  };
} 