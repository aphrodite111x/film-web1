export interface Episode {
  id: string;
  number: number;
  title: string;
  titleVietnamese: string;
  description: string;
  duration: string;
  thumbnail: string;
  releaseDate: string;
  rating: number;
  watched: boolean;
  watchProgress?: number; // percentage watched (0-100)
  lastWatchedAt?: string;
  guestCast?: string[];
  directorNotes?: string;
  hasBehindScenes?: boolean;
  hasCommentary?: boolean;
  sourceUrl?: string; // URL from crawled data
  videoUrl?: string; // Custom uploaded video URL
  hlsUrl?: string; // HLS manifest URL for streaming
  hasVideo?: boolean; // Whether video is available
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  rating: number;
  timestamp: string;
  likes: number;
  replies?: Comment[];
}

export interface Series {
  id: string;
  title: string;
  titleVietnamese: string;
  description: string;
  year: number;
  rating: number;
  genre: string[];
  director: string;
  studio: string;
  thumbnail: string;
  banner: string;
  trailer: string;
  featured: boolean;
  new: boolean;
  popular: boolean;
  episodeCount: number;
  episodes: Episode[];
  totalDuration: string;
  status: 'ongoing' | 'completed' | 'upcoming';
  comments: Comment[];
  similarSeries: string[]; // IDs of similar series
  topEpisodes: string[]; // Episode IDs sorted by rating
}

export interface Movie {
  id: string;
  title: string;
  titleVietnamese: string;
  description: string;
  year: number;
  duration: string;
  rating: number;
  genre: string[];
  director: string;
  studio: string;
  thumbnail: string;
  banner: string;
  trailer: string;
  featured: boolean;
  new: boolean;
  popular: boolean;
  type: 'movie' | 'series';
  episodeCount?: number;
  airDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  airTime?: string;
  slug?: string; // URL slug for routing
}

export interface Genre {
  id: string;
  name: string;
  movies: Movie[];
}

export interface WatchProgress {
  seriesId: string;
  episodeId: string;
  progress: number; // seconds watched
  duration: number; // total duration in seconds
  percentage: number; // percentage watched (0-100)
  lastWatchedAt: string;
  completed: boolean;
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Auth & User Types
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  isVip: boolean;
  isAdmin?: boolean; // Admin permission for video upload
  vipExpiry?: string;
  createdAt: string;
  watchHistory?: WatchProgress[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// VIP Types
export interface VipPlan {
  id: string;
  name: string;
  duration: number; // in months
  price: number;
  originalPrice?: number;
  features: string[];
  popular?: boolean;
  discount?: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  qrCode: string;
  accountInfo: string;
}

export interface PaymentTransaction {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  qrCode: string;
  createdAt: string;
  confirmedAt?: string;
  expiresAt: string;
}

// Video Upload Types
export interface VideoSegment {
  index: number;
  duration: number;
  url: string;
  size: number;
}

export interface UploadedVideo {
  id: string;
  title: string;
  episodeNumber: number;
  duration: string;
  fileSize: number;
  videoUrl: string;
  hlsUrl?: string;
  segments: VideoSegment[];
  uploadedAt: string;
  quality: string;
  codec: string;
  bitrate: string;
}