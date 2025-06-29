import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Upload, Play, Clock, ArrowLeft } from 'lucide-react';
import { Series, Episode } from '../types';
import HLSVideoPlayer from '../components/HLSVideoPlayer';
import VideoUploadModal from '../components/VideoUploadModal';
import { useAuth } from '../contexts/AuthContext';
import { createSlug } from '../utils/slugUtils';

const EpisodePlayerPage: React.FC = () => {
  const { seriesSlug, episodeNumber } = useParams<{ seriesSlug: string; episodeNumber: string }>();
  const navigate = useNavigate();
  
  const [series, setSeries] = useState<Series | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [showAutoplayCountdown, setShowAutoplayCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [videoData, setVideoData] = useState<any>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeProgress, setResumeProgress] = useState<any>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [actualResumeTime, setActualResumeTime] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const { user, getResumePrompt } = useAuth();

  // Refs để tránh infinite loop
  const loadedVideoRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const resumePromptCheckedRef = useRef(false);

  // Load series and episode data
  useEffect(() => {
    if (seriesSlug && episodeNumber) {
      loadSeriesAndEpisodeData();
    }
  }, [seriesSlug, episodeNumber]);

  const loadSeriesAndEpisodeData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔍 EpisodePlayerPage: Looking for series with slug: "${seriesSlug}", episode: ${episodeNumber}`);

      // Get all series from database
      const response = await fetch('http://localhost:3001/api/series');
      const data = await response.json();
      
      console.log('📊 API Response:', data);
      
      if (data.success) {
        console.log('📊 Available series from database:', data.series.length);
        
        // Debug: Show all series with their generated slugs
        const seriesWithSlugs = data.series.map((s: any) => {
          const generatedSlug = createSlug(s.title);
          console.log(`🔗 Series: "${s.title}" → slug: "${generatedSlug}"`);
          return {
            id: s.id,
            title: s.title,
            slug: generatedSlug,
            originalData: s
          };
        });

        setDebugInfo({
          searchSlug: seriesSlug,
          searchEpisode: episodeNumber,
          availableSeries: seriesWithSlugs,
          totalSeries: data.series.length
        });

        // Find series by slug - CASE INSENSITIVE
        const foundSeries = data.series.find((s: any) => {
          const generatedSlug = createSlug(s.title);
          const match = generatedSlug.toLowerCase() === seriesSlug?.toLowerCase();
          console.log(`🔗 Comparing "${generatedSlug}" with "${seriesSlug}" → ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
          return match;
        });

        if (!foundSeries) {
          console.error(`❌ No series found for slug: "${seriesSlug}"`);
          console.log('🔍 Available slugs:', seriesWithSlugs.map(s => s.slug));
          setError(`Series không tồn tại. Slug tìm kiếm: "${seriesSlug}"`);
          return;
        }

        console.log(`✅ Found series: "${foundSeries.title}" (ID: ${foundSeries.id})`);

        // Load episodes for this series
        console.log(`📺 Loading episodes for series ID: ${foundSeries.id}`);
        const episodesResponse = await fetch(`http://localhost:3001/api/series/${foundSeries.id}/episodes`);
        const episodesData = await episodesResponse.json();
        
        console.log('📺 Episodes API Response:', episodesData);
        
        const episodes: Episode[] = episodesData.success ? episodesData.episodes.map((ep: any) => ({
          id: ep.id,
          number: ep.number,
          title: ep.title,
          titleVietnamese: ep.titleVietnamese || ep.title,
          description: ep.description || '',
          duration: ep.duration || '24:00',
          thumbnail: ep.thumbnail || foundSeries.thumbnail || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=400',
          releaseDate: ep.releaseDate || new Date().toISOString(),
          rating: ep.rating || 0,
          watched: ep.watched || false,
          watchProgress: ep.watchProgress || 0,
          lastWatchedAt: ep.lastWatchedAt,
          guestCast: ep.guestCast || [],
          directorNotes: ep.directorNotes,
          hasBehindScenes: ep.hasBehindScenes || false,
          hasCommentary: ep.hasCommentary || false,
          sourceUrl: ep.sourceUrl,
          videoUrl: ep.hlsUrl,
          hlsUrl: ep.hlsUrl,
          hasVideo: ep.hasVideo || false
        })) : [];

        console.log(`📺 Loaded ${episodes.length} episodes`);

        const seriesData: Series = {
          id: foundSeries.id,
          title: foundSeries.title,
          titleVietnamese: foundSeries.title_vietnamese || foundSeries.title,
          description: foundSeries.description || '',
          year: foundSeries.year,
          rating: foundSeries.rating,
          genre: foundSeries.genre || [],
          director: foundSeries.director || '',
          studio: foundSeries.studio || '',
          thumbnail: foundSeries.thumbnail || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=400',
          banner: foundSeries.banner || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200',
          trailer: foundSeries.trailer || '',
          featured: foundSeries.featured || false,
          new: foundSeries.new || false,
          popular: foundSeries.popular || false,
          episodeCount: episodes.length,
          episodes: episodes,
          totalDuration: foundSeries.total_duration || '24 phút/tập',
          status: foundSeries.status || 'ongoing',
          comments: [],
          similarSeries: [],
          topEpisodes: episodes.slice(0, 3).map(ep => ep.id)
        };

        setSeries(seriesData);

        // Find current episode
        const epNum = parseInt(episodeNumber);
        console.log(`🔍 Looking for episode number: ${epNum}`);
        console.log(`📺 Available episodes:`, episodes.map(ep => ({ number: ep.number, title: ep.title })));
        
        const episode = episodes.find(ep => ep.number === epNum);
        
        if (!episode) {
          console.error(`❌ Episode ${episodeNumber} not found in series "${foundSeries.title}"`);
          console.log(`📺 Available episode numbers:`, episodes.map(ep => ep.number));
          setError(`Tập ${episodeNumber} không tồn tại trong series này`);
          return;
        }

        console.log(`✅ Found episode ${epNum}: "${episode.title}"`);
        setCurrentEpisode(episode);
        
        // FIXED: Load video data using series slug and episode number (not ID)
        loadVideoData(seriesSlug, epNum);
      } else {
        console.error('❌ API Error:', data.error);
        setError('Không thể tải dữ liệu series từ database');
      }
    } catch (error) {
      console.error('❌ Network Error loading series and episode:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  // FIXED: Load video data using series slug and episode number (not ID)
  const loadVideoData = useCallback(async (slug: string, epNumber: number) => {
    const videoKey = `${slug}-${epNumber}`;
    
    if (loadedVideoRef.current === videoKey || isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoadingVideo(true);
    setLoadError(null);
    
    try {
      console.log(`🔍 Loading video for series slug "${slug}" episode ${epNumber}`);
      
      // FIXED: Use slug instead of ID to match server endpoint
      const response = await fetch(`http://localhost:3001/api/videos/${slug}/${epNumber}`);
      const data = await response.json();
      
      console.log('📹 Video API Response:', data);
      
      if (data.success) {
        console.log('✅ Video data loaded:', data.video);
        
        const newVideoData = {
          id: data.video.id,
          title: data.video.title,
          hlsUrl: `http://localhost:3001${data.video.hlsUrl}`,
          duration: data.video.duration,
          status: data.video.status,
          totalSegments: data.video.totalSegments
        };
        
        console.log('🎬 Final video data:', newVideoData);
        setVideoData(newVideoData);
        loadedVideoRef.current = videoKey;
        
      } else {
        console.log('❌ No video found:', data.error);
        setVideoData(null);
        loadedVideoRef.current = null;
      }
    } catch (error) {
      console.error('❌ Failed to load video:', error);
      setLoadError('Không thể tải thông tin video');
      setVideoData(null);
      loadedVideoRef.current = null;
    } finally {
      setIsLoadingVideo(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Check resume prompt
  useEffect(() => {
    if (
      user && 
      series && 
      currentEpisode && 
      videoData && 
      !showResumePrompt && 
      !hasStartedWatching && 
      !resumePromptCheckedRef.current
    ) {
      const { shouldPrompt, progress } = getResumePrompt(series.id, currentEpisode.id);
      resumePromptCheckedRef.current = true;
      
      if (shouldPrompt && progress) {
        console.log('📋 Showing resume prompt for progress:', progress);
        setResumeProgress(progress);
        setShowResumePrompt(true);
      } else {
        setActualResumeTime(0);
      }
    }
  }, [user, series?.id, currentEpisode?.id, videoData?.id, getResumePrompt, showResumePrompt, hasStartedWatching]);

  // Autoplay countdown effect
  useEffect(() => {
    if (showAutoplayCountdown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (showAutoplayCountdown && countdown === 0) {
      handleNextEpisode();
      setShowAutoplayCountdown(false);
      setCountdown(10);
    }
  }, [showAutoplayCountdown, countdown]);

  const handleNextEpisode = () => {
    if (series && currentEpisode) {
      const currentIndex = series.episodes.findIndex(ep => ep.id === currentEpisode.id);
      const nextEpisode = currentIndex < series.episodes.length - 1 ? series.episodes[currentIndex + 1] : null;
      
      if (nextEpisode) {
        const slug = createSlug(series.title);
        console.log(`⏭️ Next episode: /series/${slug}/tap/${nextEpisode.number}`);
        navigate(`/series/${slug}/tap/${nextEpisode.number}`);
      }
    }
  };

  const handlePrevEpisode = () => {
    if (series && currentEpisode) {
      const currentIndex = series.episodes.findIndex(ep => ep.id === currentEpisode.id);
      const prevEpisode = currentIndex > 0 ? series.episodes[currentIndex - 1] : null;
      
      if (prevEpisode) {
        const slug = createSlug(series.title);
        console.log(`⏮️ Previous episode: /series/${slug}/tap/${prevEpisode.number}`);
        navigate(`/series/${slug}/tap/${prevEpisode.number}`);
      }
    }
  };

  const handleEpisodeChange = (episode: Episode) => {
    if (series) {
      const slug = createSlug(series.title);
      console.log(`🔄 Episode change: /series/${slug}/tap/${episode.number}`);
      navigate(`/series/${slug}/tap/${episode.number}`);
    }
  };

  const handleGoBack = () => {
    if (series) {
      const slug = createSlug(series.title);
      navigate(`/series/${slug}`);
    } else {
      navigate('/');
    }
  };

  const handleVideoEnded = () => {
    if (series && currentEpisode) {
      const currentIndex = series.episodes.findIndex(ep => ep.id === currentEpisode.id);
      const nextEpisode = currentIndex < series.episodes.length - 1 ? series.episodes[currentIndex + 1] : null;
      
      if (nextEpisode) {
        setShowAutoplayCountdown(true);
        setCountdown(10);
      }
    }
  };

  const handleVideoUploaded = (uploadedVideoData: any) => {
    setVideoData({
      id: uploadedVideoData.id,
      title: uploadedVideoData.title,
      hlsUrl: uploadedVideoData.hlsUrl,
      duration: uploadedVideoData.duration,
      status: 'completed'
    });
    if (seriesSlug && currentEpisode) {
      loadedVideoRef.current = `${seriesSlug}-${currentEpisode.number}`;
    }
  };

  const handleResumeVideo = () => {
    console.log('▶️ User chose to resume video at:', resumeProgress?.progress);
    setActualResumeTime(resumeProgress?.progress || 0);
    setShowResumePrompt(false);
    setHasStartedWatching(true);
  };

  const handleStartFromBeginning = () => {
    console.log('🔄 User chose to start from beginning');
    setActualResumeTime(0);
    setShowResumePrompt(false);
    setResumeProgress(null);
    setHasStartedWatching(true);
  };

  const handleVideoTimeUpdate = (currentTime: number, duration: number) => {
    if (currentTime > 5 && !hasStartedWatching) {
      console.log('🎬 User started watching (5+ seconds)');
      setHasStartedWatching(true);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Đang tải episode...</p>
          <p className="text-gray-400 text-sm mt-2">Slug: {seriesSlug}, Episode: {episodeNumber}</p>
          <p className="text-gray-400 text-xs mt-1">Đang kết nối database...</p>
        </div>
      </div>
    );
  }

  if (error || !series || !currentEpisode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-4xl mx-auto p-8">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-4xl font-bold text-white mb-4">404</h1>
          <h2 className="text-2xl font-bold text-white mb-4">Trang không tồn tại</h2>
          <p className="text-xl text-gray-300 mb-4">Xin lỗi, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
          
          {/* Debug Information */}
          {debugInfo && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8 text-left">
              <h3 className="text-white font-semibold mb-4">🔍 Debug Information:</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-blue-400">Slug tìm kiếm:</span> "{debugInfo.searchSlug}"
                </p>
                <p className="text-gray-300">
                  <span className="text-blue-400">Episode tìm kiếm:</span> {debugInfo.searchEpisode}
                </p>
                <p className="text-gray-300">
                  <span className="text-blue-400">Tổng series trong DB:</span> {debugInfo.totalSeries}
                </p>
                <p className="text-gray-300">
                  <span className="text-red-400">Lỗi:</span> {error}
                </p>
                <div className="text-gray-300">
                  <span className="text-blue-400">Series có sẵn:</span>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {debugInfo.availableSeries.map((s: any, index: number) => (
                      <div key={index} className="text-xs bg-gray-700 p-2 rounded">
                        <span className="text-green-400">"{s.title}"</span> → 
                        <span className="text-yellow-400"> "{s.slug}"</span>
                        <button
                          onClick={() => navigate(`/series/${s.slug}`)}
                          className="ml-2 text-blue-400 hover:text-blue-300 underline"
                        >
                          Thử link này
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGoBack}
              className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Quay Lại</span>
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors"
            >
              Về Trang Chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canUpload = user?.isAdmin;
  const hasVideo = videoData && videoData.status === 'completed';
  const currentIndex = series.episodes.findIndex(ep => ep.id === currentEpisode.id);
  const nextEpisode = currentIndex < series.episodes.length - 1 ? series.episodes[currentIndex + 1] : null;
  const prevEpisode = currentIndex > 0 ? series.episodes[currentIndex - 1] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Resume Prompt Overlay */}
      {showResumePrompt && resumeProgress && !hasStartedWatching && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-30">
          <div className="bg-gray-900 rounded-xl p-8 max-w-md text-center border border-gray-700">
            <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-white text-xl font-bold mb-4">Tiếp tục xem?</h3>
            <p className="text-gray-300 mb-2">
              Bạn đã xem tới <span className="text-blue-400 font-semibold">{formatTime(resumeProgress.progress)}</span>
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Lần cuối xem: {new Date(resumeProgress.lastWatchedAt).toLocaleDateString('vi-VN')}
            </p>
            
            <div className="bg-gray-800 rounded-lg p-3 mb-6">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${resumeProgress.percentage}%` }}
                />
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Đã xem {Math.round(resumeProgress.percentage)}%
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleStartFromBeginning}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
              >
                Xem từ đầu
              </button>
              <button
                onClick={handleResumeVideo}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Tiếp tục</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Container */}
      <div className="relative w-full h-full">
        {isLoadingVideo ? (
          <div className="relative w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-xl">Đang kiểm tra video...</p>
              <p className="text-gray-300 text-sm mt-2">Tìm kiếm video cho tập {episodeNumber}...</p>
              <p className="text-gray-400 text-xs mt-1">Using series slug "{seriesSlug}"</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="relative w-full h-full bg-gradient-to-br from-red-900 via-gray-900 to-black flex items-center justify-center">
            <div className="text-center max-w-2xl mx-auto p-8">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h1 className="text-4xl font-bold text-white mb-4">Lỗi tải video</h1>
              <p className="text-xl text-gray-300 mb-8">{loadError}</p>
              <button
                onClick={() => {
                  loadedVideoRef.current = null;
                  if (seriesSlug && currentEpisode) {
                    loadVideoData(seriesSlug, currentEpisode.number);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : hasVideo ? (
          <HLSVideoPlayer
            src={videoData.hlsUrl}
            title={`${series.title} - Tập ${currentEpisode.number}: ${currentEpisode.title}`}
            seriesId={series.id}
            episodeId={currentEpisode.id}
            videoId={videoData.id}
            onEnded={handleVideoEnded}
            onTimeUpdate={handleVideoTimeUpdate}
            resumeTime={actualResumeTime}
            className="w-full h-full"
          />
        ) : (
          <div className="relative w-full h-full bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
            <div className="text-center max-w-2xl mx-auto p-8">
              <div className="mb-8">
                <img
                  src={currentEpisode.thumbnail}
                  alt={currentEpisode.title}
                  className="w-64 h-96 object-cover rounded-lg mx-auto shadow-2xl"
                />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                Tập {currentEpisode.number}: {currentEpisode.title}
              </h1>
              <h2 className="text-2xl md:text-3xl text-blue-300 mb-8">
                {currentEpisode.titleVietnamese}
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                {canUpload 
                  ? "Chưa có video cho tập này. Tải video lên để xem!" 
                  : "Video chưa có sẵn. Vui lòng quay lại sau."
                }
              </p>
              {canUpload && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors flex items-center space-x-2 mx-auto"
                >
                  <Upload className="h-6 w-6" />
                  <span>Tải Video Lên (Admin)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Autoplay Countdown Overlay */}
        {showAutoplayCountdown && nextEpisode && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="bg-gray-900 rounded-xl p-8 max-w-md text-center">
              <h3 className="text-white text-xl font-bold mb-4">Sắp phát tập tiếp theo</h3>
              <div className="flex items-center space-x-4 mb-6">
                <img
                  src={nextEpisode.thumbnail}
                  alt={nextEpisode.title}
                  className="w-20 h-28 object-cover rounded"
                />
                <div className="text-left">
                  <p className="text-white font-semibold">Tập {nextEpisode.number}</p>
                  <p className="text-blue-300">{nextEpisode.title}</p>
                  <p className="text-gray-400 text-sm">{nextEpisode.titleVietnamese}</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-4">{countdown}s</div>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowAutoplayCountdown(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleNextEpisode}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Phát ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGoBack}
                className="text-white hover:text-gray-300 transition-colors flex items-center space-x-2"
              >
                <ArrowLeft className="h-6 w-6" />
                <span className="hidden md:inline">Quay lại</span>
              </button>
              <div>
                <h3 className="text-white font-semibold text-lg">{series.title}</h3>
                <p className="text-gray-300 text-sm">Tập {currentEpisode.number}: {currentEpisode.title}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {canUpload && !hasVideo && (
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Tải Video</span>
                </button>
              )}
              <button
                onClick={() => setShowEpisodeList(!showEpisodeList)}
                className="bg-gray-700/70 text-white px-4 py-2 rounded-lg hover:bg-gray-600/70 transition-colors"
              >
                Danh sách tập
              </button>
            </div>
          </div>
        </div>

        {/* Episode Navigation */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
          <button
            onClick={handlePrevEpisode}
            disabled={!prevEpisode}
            className="bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>

        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
          <button
            onClick={handleNextEpisode}
            disabled={!nextEpisode}
            className="bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Episode List Sidebar */}
        {showEpisodeList && (
          <div className="absolute top-0 right-0 w-80 h-full bg-gray-900/95 backdrop-blur-md overflow-y-auto z-30">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Danh sách tập</h3>
                <button
                  onClick={() => setShowEpisodeList(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {series.episodes.map((episode) => {
                  const watchProgress = user ? getResumePrompt(series.id, episode.id).progress : null;
                  
                  return (
                    <div
                      key={episode.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        episode.id === currentEpisode.id 
                          ? 'bg-blue-600' 
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                      onClick={() => {
                        if (episode.id !== currentEpisode.id) {
                          handleEpisodeChange(episode);
                        }
                      }}
                    >
                      <img
                        src={episode.thumbnail}
                        alt={episode.title}
                        className="w-16 h-10 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          Tập {episode.number}: {episode.title}
                        </p>
                        <p className="text-gray-400 text-xs truncate">{episode.titleVietnamese}</p>
                        <p className="text-gray-400 text-xs">{episode.duration}</p>
                        
                        {/* Watch Progress Bar */}
                        {watchProgress && watchProgress.percentage > 5 && (
                          <div className="mt-1">
                            <div className="w-full bg-gray-700 rounded-full h-1">
                              <div 
                                className="bg-blue-400 h-1 rounded-full"
                                style={{ width: `${watchProgress.percentage}%` }}
                              />
                            </div>
                            <p className="text-gray-500 text-xs mt-1">
                              {Math.round(watchProgress.percentage)}% đã xem
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center space-y-1">
                        <div className={`w-2 h-2 rounded-full ${episode.hasVideo ? 'bg-green-400' : 'bg-gray-600'}`} title={episode.hasVideo ? 'Có video' : 'Chưa có video'}></div>
                        {watchProgress?.completed && (
                          <div className="w-2 h-2 bg-blue-400 rounded-full" title="Đã xem xong"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Upload Modal - Only for Admin */}
      {canUpload && (
        <VideoUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onVideoUploaded={handleVideoUploaded}
          episodeNumber={currentEpisode.number}
          seriesTitle={series.title}
          seriesId={series.id}
        />
      )}
    </div>
  );
};

export default EpisodePlayerPage;