import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, WatchProgress } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
  updateWatchProgress: (seriesId: string, episodeId: string, progress: number, duration: number) => void;
  getWatchProgress: (seriesId: string, episodeId: string) => WatchProgress | null;
  getResumePrompt: (seriesId: string, episodeId: string) => { shouldPrompt: boolean; progress: WatchProgress | null };
  addToFavorites: (seriesId: string) => Promise<boolean>;
  removeFromFavorites: (seriesId: string) => Promise<boolean>;
  rateSeries: (seriesId: string, episodeId: string | null, rating: number) => Promise<boolean>;
  addComment: (seriesId: string, episodeId: string | null, content: string, rating?: number) => Promise<boolean>;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored token on app load
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      // Verify token with server
      verifyToken(storedToken);
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAuthState({
            user: {
              id: data.user.id,
              email: data.user.email,
              username: data.user.username,
              avatar: data.user.avatar,
              isVip: data.user.isVip,
              isAdmin: data.user.isAdmin,
              vipExpiry: data.user.vipExpiry,
              createdAt: data.user.createdAt,
              watchHistory: []
            },
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
      
      // Token invalid
      localStorage.removeItem('token');
      setToken(null);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('token');
      setToken(null);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          avatar: data.user.avatar,
          isVip: data.user.isVip,
          isAdmin: data.user.isAdmin,
          vipExpiry: data.user.vipExpiry,
          createdAt: data.user.createdAt,
          watchHistory: []
        };

        localStorage.setItem('token', data.token);
        setToken(data.token);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (email: string, username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      });

      const data = await response.json();
      
      if (data.success) {
        const user: User = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          avatar: data.user.avatar,
          isVip: data.user.isVip,
          isAdmin: data.user.isAdmin,
          createdAt: data.user.createdAt,
          watchHistory: []
        };

        localStorage.setItem('token', data.token);
        setToken(data.token);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Register error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateUser = (user: User) => {
    setAuthState(prev => ({
      ...prev,
      user,
    }));
  };

  const updateWatchProgress = async (seriesId: string, episodeId: string, progress: number, duration: number) => {
    if (!authState.user || !token) return;

    try {
      await fetch('http://localhost:3001/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          seriesId,
          episodeId,
          progress,
          duration
        })
      });
    } catch (error) {
      console.error('Failed to update watch progress:', error);
    }
  };

  const addToFavorites = async (seriesId: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`http://localhost:3001/api/favorites/${seriesId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to add to favorites:', error);
      return false;
    }
  };

  const removeFromFavorites = async (seriesId: string): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`http://localhost:3001/api/favorites/${seriesId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to remove from favorites:', error);
      return false;
    }
  };

  const rateSeries = async (seriesId: string, episodeId: string | null, rating: number): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch('http://localhost:3001/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          seriesId,
          episodeId,
          rating
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to rate:', error);
      return false;
    }
  };

  const addComment = async (seriesId: string, episodeId: string | null, content: string, rating?: number): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch('http://localhost:3001/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          seriesId,
          episodeId,
          content,
          rating
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return false;
    }
  };

  // Legacy methods for compatibility
  const getWatchProgress = (seriesId: string, episodeId: string): WatchProgress | null => {
    // This would need to be fetched from server in real implementation
    return null;
  };

  const getResumePrompt = (seriesId: string, episodeId: string) => {
    // This would need to be fetched from server in real implementation
    return { shouldPrompt: false, progress: null };
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        updateUser,
        updateWatchProgress,
        getWatchProgress,
        getResumePrompt,
        addToFavorites,
        removeFromFavorites,
        rateSeries,
        addComment,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};