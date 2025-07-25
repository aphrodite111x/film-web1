import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Play, 
  Eye, 
  Search, 
  Save,
  X,
  Film,
  Calendar,
  Clock,
  Star,
  Users,
  Database,
  Settings,
  BarChart3,
  Video,
  FileText,
  Image,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Movie, Series, Episode } from '../types';
import VideoUploadModal from './VideoUploadModal';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SeriesFormData {
  title: string;
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
  totalDuration: string;
  status: 'ongoing' | 'completed' | 'upcoming';
  airDay: string;
  airTime: string;
}

interface EpisodeFormData {
  number: number;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  releaseDate: string;
  rating: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'series'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<any>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [seriesData, setSeriesData] = useState<any[]>([]);
  const [videosData, setVideosData] = useState<any[]>([]);
  const [episodesData, setEpisodesData] = useState<any[]>([]);

  // Form states
  const [seriesForm, setSeriesForm] = useState<SeriesFormData>({
    title: '',
    description: '',
    year: new Date().getFullYear(),
    rating: 0,
    genre: [],
    director: '',
    studio: '',
    thumbnail: '',
    banner: '',
    trailer: '',
    featured: false,
    new: false,
    popular: false,
    totalDuration: '',
    status: 'ongoing',
    airDay: '',
    airTime: ''
  });

  const [episodeForm, setEpisodeForm] = useState<EpisodeFormData>({
    number: 1,
    title: '',
    description: '',
    duration: '',
    thumbnail: '',
    releaseDate: new Date().toISOString().split('T')[0],
    rating: 0
  });

  const genreOptions = [
    'Hành Động', 'Phiêu Lưu', 'Tu Tiên', 'Drama', 'Romance', 'Comedy', 
    'Siêu Nhiên', 'Mecha', 'Slice of Life', 'Thriller', 'Horror', 'Mystery'
  ];

  const weekDays = [
    { value: 'monday', label: 'Thứ Hai' },
    { value: 'tuesday', label: 'Thứ Ba' },
    { value: 'wednesday', label: 'Thứ Tư' },
    { value: 'thursday', label: 'Thứ Năm' },
    { value: 'friday', label: 'Thứ Sáu' },
    { value: 'saturday', label: 'Thứ Bảy' },
    { value: 'sunday', label: 'Chủ Nhật' }
  ];

  // Load data
  useEffect(() => {
    if (isOpen) {
      loadSeriesData();
      loadVideosData();
    }
  }, [isOpen]);

  const loadSeriesData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:3001/api/series');
      const data = await response.json();
      
      if (data.success) {
        setSeriesData(data.series);
        console.log('✅ Loaded series data:', data.series);
      } else {
        setError('Không thể tải dữ liệu series');
      }
    } catch (error) {
      console.error('Error loading series:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVideosData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/videos/all');
      const data = await response.json();
      
      if (data.success) {
        setVideosData(data.videos);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const loadEpisodesForSeries = async (seriesId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/series/${seriesId}/episodes`);
      const data = await response.json();
      
      if (data.success) {
        setEpisodesData(data.episodes);
      }
    } catch (error) {
      console.error('Error loading episodes:', error);
    }
  };

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateSeries = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Prepare data for API
      const apiData = {
        title: seriesForm.title,
        titleVietnamese: seriesForm.title, // Use same title since we removed English title
        description: seriesForm.description,
        year: seriesForm.year,
        rating: seriesForm.rating,
        genre: seriesForm.genre,
        director: seriesForm.director,
        studio: seriesForm.studio,
        thumbnail: seriesForm.thumbnail,
        banner: seriesForm.banner,
        trailer: seriesForm.trailer,
        featured: seriesForm.featured,
        new: seriesForm.new,
        popular: seriesForm.popular,
        totalDuration: seriesForm.totalDuration,
        status: seriesForm.status,
        airDay: seriesForm.airDay,
        airTime: seriesForm.airTime
      };

      const url = editingItem 
        ? `http://localhost:3001/api/series/${editingItem.id}`
        : 'http://localhost:3001/api/series';
      
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Series saved successfully:', data.series);
        await loadSeriesData(); // Reload data to show new series
        setIsSeriesModalOpen(false);
        resetSeriesForm();
        setEditingItem(null);
      } else {
        setError(data.error || 'Không thể lưu series');
      }
    } catch (error) {
      console.error('Error saving series:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEpisode = async () => {
    if (!selectedSeries) return;

    try {
      setIsLoading(true);
      setError(null);

      const apiData = {
        number: episodeForm.number,
        title: episodeForm.title,
        titleVietnamese: episodeForm.title, // Use same title
        description: episodeForm.description,
        duration: episodeForm.duration,
        thumbnail: episodeForm.thumbnail,
        releaseDate: episodeForm.releaseDate,
        rating: episodeForm.rating
      };

      const response = await fetch(`http://localhost:3001/api/series/${selectedSeries.id}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData)
      });

      const data = await response.json();
      
      if (data.success) {
        await loadEpisodesForSeries(selectedSeries.id);
        await loadSeriesData(); // Refresh series data to update episode count
        setIsEpisodeModalOpen(false);
        resetEpisodeForm();
      } else {
        setError(data.error || 'Không thể tạo episode');
      }
    } catch (error) {
      console.error('Error creating episode:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa video này? Hành động này không thể hoàn tác.')) {
      return;
    }

    if (!confirm('Xác nhận lần 2: Video và tất cả files liên quan sẽ bị xóa vĩnh viễn!')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3001/api/video/${videoId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await loadVideosData();
        if (selectedSeries) {
          await loadEpisodesForSeries(selectedSeries.id);
        }
      } else {
        setError(data.error || 'Không thể xóa video');
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa series này? Tất cả episodes và videos sẽ bị xóa!')) {
      return;
    }

    if (!confirm('Xác nhận lần 2: Hành động này không thể hoàn tác!')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3001/api/series/${seriesId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        await loadSeriesData();
        await loadVideosData();
        if (selectedSeries?.id === seriesId) {
          setSelectedSeries(null);
          setEpisodesData([]);
        }
      } else {
        setError(data.error || 'Không thể xóa series');
      }
    } catch (error) {
      console.error('Error deleting series:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoUpload = (seriesId: string, episodeNumber: number) => {
    const targetSeries = seriesData.find(s => s.id === seriesId);
    if (targetSeries) {
      setSelectedSeries(targetSeries);
      setSelectedEpisode({ number: episodeNumber } as Episode);
      setIsUploadModalOpen(true);
    }
  };

  const resetSeriesForm = () => {
    setSeriesForm({
      title: '',
      description: '',
      year: new Date().getFullYear(),
      rating: 0,
      genre: [],
      director: '',
      studio: '',
      thumbnail: '',
      banner: '',
      trailer: '',
      featured: false,
      new: false,
      popular: false,
      totalDuration: '',
      status: 'ongoing',
      airDay: '',
      airTime: ''
    });
  };

  const resetEpisodeForm = () => {
    setEpisodeForm({
      number: 1,
      title: '',
      description: '',
      duration: '',
      thumbnail: '',
      releaseDate: new Date().toISOString().split('T')[0],
      rating: 0
    });
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Tổng Series</p>
              <p className="text-3xl font-bold">{seriesData.length}</p>
            </div>
            <Film className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Tổng Episodes</p>
              <p className="text-3xl font-bold">{seriesData.reduce((sum, s) => sum + s.episodeCount, 0)}</p>
            </div>
            <Video className="h-12 w-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Videos Uploaded</p>
              <p className="text-3xl font-bold">{videosData.filter(v => v.status === 'completed').length}</p>
            </div>
            <Upload className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Processing</p>
              <p className="text-3xl font-bold">{videosData.filter(v => v.status === 'processing').length}</p>
            </div>
            <Clock className="h-12 w-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Hoạt Động Gần Đây</span>
        </h3>
        <div className="space-y-3">
          {videosData.slice(0, 5).map((video) => (
            <div key={video.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  video.status === 'completed' ? 'bg-green-400' : 
                  video.status === 'processing' ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
                <div>
                  <p className="text-white font-medium">{video.title}</p>
                  <p className="text-gray-400 text-sm">
                    {new Date(video.uploadedAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                video.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                video.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {video.status === 'completed' ? 'Hoàn thành' :
                 video.status === 'processing' ? 'Đang xử lý' : 'Lỗi'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSeries = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Quản Lý Series</h2>
        <button
          onClick={() => {
            resetSeriesForm();
            setEditingItem(null);
            setIsSeriesModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm Series Mới</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm series..."
          className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          <span className="text-white ml-2">Đang tải...</span>
        </div>
      )}

      {/* Series List */}
      <div className="space-y-4">
        {seriesData
          .filter(series => 
            series.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((series) => (
            <div key={series.id} className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex space-x-4">
                  <img
                    src={series.thumbnail || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=200'}
                    alt={series.title}
                    className="w-24 h-36 object-cover rounded-lg"
                  />
                  <div>
                    <h3 className="text-white font-semibold text-xl mb-1">{series.title}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-2">
                      <span>{series.year}</span>
                      <span>{series.episodeCount} tập</span>
                      <span>{series.videosCount} videos</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current" />
                        <span>{series.rating}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {series.genre.slice(0, 3).map((genre, index) => (
                        <span
                          key={index}
                          className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedSeries(series);
                      loadEpisodesForSeries(series.id);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-1"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Quản Lý Episodes</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(series);
                      setSeriesForm({
                        title: series.title,
                        description: series.description,
                        year: series.year,
                        rating: series.rating,
                        genre: series.genre,
                        director: series.director,
                        studio: series.studio,
                        thumbnail: series.thumbnail,
                        banner: series.banner,
                        trailer: series.trailer,
                        featured: series.featured,
                        new: series.new,
                        popular: series.popular,
                        totalDuration: series.totalDuration,
                        status: series.status,
                        airDay: series.airDay,
                        airTime: series.airTime
                      });
                      setIsSeriesModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSeries(series.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Episodes Management */}
              {selectedSeries?.id === series.id && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium">Danh Sách Episodes ({episodesData.length})</h4>
                    <button
                      onClick={() => {
                        resetEpisodeForm();
                        setEpisodeForm(prev => ({ ...prev, number: episodesData.length + 1 }));
                        setIsEpisodeModalOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Thêm Episode</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {episodesData.map((episode) => {
                      const hasVideo = videosData.some(v => 
                        v.series_id === series.id && 
                        v.episode_number === episode.number && 
                        v.status === 'completed'
                      );
                      
                      const video = videosData.find(v => 
                        v.series_id === series.id && 
                        v.episode_number === episode.number
                      );
                      
                      return (
                        <div key={episode.id} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-white font-medium">Tập {episode.number}</h5>
                            <div className="flex space-x-1">
                              {!hasVideo && (
                                <button
                                  onClick={() => handleVideoUpload(series.id, episode.number)}
                                  className="bg-green-600 hover:bg-green-700 text-white p-1 rounded transition-colors"
                                  title="Upload Video"
                                >
                                  <Upload className="h-3 w-3" />
                                </button>
                              )}
                              {video && (
                                <button
                                  onClick={() => handleDeleteVideo(video.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white p-1 rounded transition-colors"
                                  title="Xóa Video"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingItem(episode);
                                  setEpisodeForm({
                                    number: episode.number,
                                    title: episode.title,
                                    description: episode.description,
                                    duration: episode.duration,
                                    thumbnail: episode.thumbnail,
                                    releaseDate: episode.releaseDate,
                                    rating: episode.rating
                                  });
                                  setIsEpisodeModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded transition-colors"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-gray-300 text-sm mb-1">{episode.title}</p>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{episode.duration}</span>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${
                                hasVideo ? 'bg-green-400' : 
                                video?.status === 'processing' ? 'bg-yellow-400' : 'bg-red-400'
                              }`} />
                              <span>
                                {hasVideo ? 'Có video' : 
                                 video?.status === 'processing' ? 'Đang xử lý' : 'Chưa có video'}
                              </span>
                            </div>
                          </div>
                          {video?.status === 'processing' && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-600 rounded-full h-1">
                                <div 
                                  className="bg-yellow-400 h-1 rounded-full transition-all"
                                  style={{ width: `${video.processing_progress || 0}%` }}
                                />
                              </div>
                              <p className="text-yellow-400 text-xs mt-1">
                                {video.processing_progress || 0}% hoàn thành
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Main Admin Panel */}
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4">
              <div className="space-y-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'overview' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                  <span>Tổng Quan</span>
                </button>

                <button
                  onClick={() => setActiveTab('series')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === 'series' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Video className="h-5 w-5" />
                  <span>Quản Lý Series</span>
                </button>
              </div>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-8">
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'series' && renderSeries()}
            </div>
          </div>
        </div>
      </div>

      {/* Series Modal - Z-INDEX CAO NHẤT */}
      {isSeriesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-gray-700">
            {/* Close Button */}
            <button
              onClick={() => setIsSeriesModalOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">
                {editingItem ? 'Chỉnh Sửa Series' : 'Thêm Series Mới'}
              </h2>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tên Series *
                </label>
                <input
                  type="text"
                  value={seriesForm.title}
                  onChange={(e) => setSeriesForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Phàm Nhân Tu Tiên"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={seriesForm.description}
                  onChange={(e) => setSeriesForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mô tả nội dung series..."
                />
              </div>

              {/* Year, Rating, Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Năm phát hành
                  </label>
                  <input
                    type="number"
                    value={seriesForm.year}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Đánh giá (0-10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={seriesForm.rating}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trạng thái
                  </label>
                  <select
                    value={seriesForm.status}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ongoing">Đang phát sóng</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="upcoming">Sắp ra mắt</option>
                  </select>
                </div>
              </div>

              {/* Director, Studio, Duration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Đạo diễn
                  </label>
                  <input
                    type="text"
                    value={seriesForm.director}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, director: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tên đạo diễn"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Studio
                  </label>
                  <input
                    type="text"
                    value={seriesForm.studio}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, studio: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tên studio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tổng thời lượng
                  </label>
                  <input
                    type="text"
                    value={seriesForm.totalDuration}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, totalDuration: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="24 phút/tập"
                  />
                </div>
              </div>

              {/* Genre Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thể loại
                </label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {genreOptions.map((genre) => (
                    <label key={genre} className="flex items-center space-x-2 text-gray-300">
                      <input
                        type="checkbox"
                        checked={seriesForm.genre.includes(genre)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSeriesForm(prev => ({ ...prev, genre: [...prev.genre, genre] }));
                          } else {
                            setSeriesForm(prev => ({ ...prev, genre: prev.genre.filter(g => g !== genre) }));
                          }
                        }}
                        className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{genre}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Thumbnail (URL hoặc Upload)
                  </label>
                  <input
                    type="url"
                    value={seriesForm.thumbnail}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/thumbnail.jpg hoặc upload file"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Banner (URL hoặc Upload)
                  </label>
                  <input
                    type="url"
                    value={seriesForm.banner}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, banner: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/banner.jpg hoặc upload file"
                  />
                </div>
              </div>

              {/* Air Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ngày phát sóng
                  </label>
                  <select
                    value={seriesForm.airDay}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, airDay: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Chọn ngày</option>
                    {weekDays.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Giờ phát sóng (24H)
                  </label>
                  <input
                    type="time"
                    value={seriesForm.airTime}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, airTime: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center space-x-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={seriesForm.featured}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Nổi bật</span>
                </label>
                <label className="flex items-center space-x-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={seriesForm.new}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, new: e.target.checked }))}
                    className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Mới</span>
                </label>
                <label className="flex items-center space-x-2 text-gray-300">
                  <input
                    type="checkbox"
                    checked={seriesForm.popular}
                    onChange={(e) => setSeriesForm(prev => ({ ...prev, popular: e.target.checked }))}
                    className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Phổ biến</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCreateSeries}
                  disabled={isLoading || !seriesForm.title}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  <Save className="h-5 w-5" />
                  <span>{editingItem ? 'Cập Nhật' : 'Tạo Series'}</span>
                </button>
                <button
                  onClick={() => setIsSeriesModalOpen(false)}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episode Modal - Z-INDEX CAO */}
      {isEpisodeModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative border border-gray-700">
            {/* Close Button */}
            <button
              onClick={() => setIsEpisodeModalOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">
                {editingItem ? 'Chỉnh Sửa Episode' : 'Thêm Episode Mới'}
              </h2>
              {selectedSeries && (
                <p className="text-purple-100 mt-1">{selectedSeries.title}</p>
              )}
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Số tập *
                  </label>
                  <input
                    type="number"
                    value={episodeForm.number}
                    onChange={(e) => setEpisodeForm(prev => ({ ...prev, number: parseInt(e.target.value) }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Thời lượng
                  </label>
                  <input
                    type="text"
                    value={episodeForm.duration}
                    onChange={(e) => setEpisodeForm(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="24:00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tên tập *
                </label>
                <input
                  type="text"
                  value={episodeForm.title}
                  onChange={(e) => setEpisodeForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tên tập phim"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={episodeForm.description}
                  onChange={(e) => setEpisodeForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mô tả nội dung tập phim..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ngày phát hành
                  </label>
                  <input
                    type="date"
                    value={episodeForm.releaseDate}
                    onChange={(e) => setEpisodeForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Đánh giá (0-10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={episodeForm.rating}
                    onChange={(e) => setEpisodeForm(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thumbnail (URL hoặc Upload)
                </label>
                <input
                  type="url"
                  value={episodeForm.thumbnail}
                  onChange={(e) => setEpisodeForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/episode-thumbnail.jpg hoặc upload file"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCreateEpisode}
                  disabled={isLoading || !episodeForm.title}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  <Save className="h-5 w-5" />
                  <span>{editingItem ? 'Cập Nhật' : 'Tạo Episode'}</span>
                </button>
                <button
                  onClick={() => setIsEpisodeModalOpen(false)}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {selectedSeries && selectedEpisode && (
        <VideoUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setSelectedSeries(null);
            setSelectedEpisode(null);
          }}
          onVideoUploaded={(videoData) => {
            loadVideosData();
            if (selectedSeries) {
              loadEpisodesForSeries(selectedSeries.id);
            }
            setIsUploadModalOpen(false);
            setSelectedSeries(null);
            setSelectedEpisode(null);
          }}
          episodeNumber={selectedEpisode.number}
          seriesTitle={selectedSeries.title}
          seriesId={selectedSeries.id}
        />
      )}
    </>
  );
};

export default AdminPanel;