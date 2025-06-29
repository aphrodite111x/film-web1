import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Star, Clock, Calendar, User, Building, ChevronDown, ChevronUp, Heart, Share2, ArrowLeft } from 'lucide-react';
import { Series, Episode } from '../types';
import Header from '../components/Header';
import EpisodeGrid from '../components/EpisodeGrid';
import Footer from '../components/Footer';
import { createSlug } from '../utils/slugUtils';

const SeriesDetailPage: React.FC = () => {
  const { seriesSlug } = useParams<{ seriesSlug: string }>();
  const navigate = useNavigate();
  
  const [series, setSeries] = useState<Series | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Load series data based on slug
  useEffect(() => {
    if (seriesSlug) {
      loadSeriesData();
    }
  }, [seriesSlug]);

  const loadSeriesData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔍 SeriesDetailPage: Looking for series with slug: "${seriesSlug}"`);

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
          comments: [], // Mock comments for now
          similarSeries: [], // Mock similar series for now
          topEpisodes: episodes.slice(0, 3).map(ep => ep.id) // Top 3 episodes
        };

        console.log('✅ Series data prepared:', seriesData);
        setSeries(seriesData);
      } else {
        console.error('❌ API Error:', data.error);
        setError('Không thể tải dữ liệu series từ database');
      }
    } catch (error) {
      console.error('❌ Network Error loading series:', error);
      setError('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayEpisode = (episode: Episode) => {
    if (series) {
      const slug = createSlug(series.title);
      console.log(`🎬 Playing episode ${episode.number}: /series/${slug}/tap/${episode.number}`);
      navigate(`/series/${slug}/tap/${episode.number}`);
    }
  };

  const handlePlayFirstEpisode = () => {
    if (series && series.episodes.length > 0) {
      handlePlayEpisode(series.episodes[0]);
    }
  };

  const handleGoBack = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Đang tải thông tin series...</p>
          <p className="text-gray-400 text-sm mt-2">Slug: {seriesSlug}</p>
          <p className="text-gray-400 text-xs mt-1">Đang kết nối database...</p>
        </div>
      </div>
    );
  }

  if (error || !series) {
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

  return (
    <div className="min-h-screen bg-gray-900">
      <Header 
        onSearch={() => {}} 
        onOpenAuth={() => {}} 
        onOpenVip={() => {}}
        onOpenAdmin={() => {}}
      />

      <main className="pt-16">
        {/* Header */}
        <div className="relative h-96 md:h-[500px] overflow-hidden">
          <img
            src={series.banner}
            alt={series.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          
          {/* Back Button */}
          <button
            onClick={handleGoBack}
            className="absolute top-6 left-6 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors z-10 flex items-center space-x-2"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="hidden md:inline">Trang Chủ</span>
          </button>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
            <div className="max-w-4xl">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-1 bg-yellow-500 text-black px-3 py-1 rounded-full">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-bold">{series.rating}</span>
                </div>
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {series.episodeCount} tập
                </span>
                <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm">
                  {series.status === 'ongoing' ? 'Đang phát sóng' : series.status === 'completed' ? 'Đã hoàn thành' : 'Sắp ra mắt'}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
                {series.title}
              </h1>
              <h2 className="text-2xl md:text-3xl text-blue-300 mb-4">
                {series.titleVietnamese}
              </h2>

              <div className="flex items-center space-x-6 text-gray-300 mb-6">
                <span>{series.year}</span>
                <span>{series.totalDuration}</span>
                <div className="flex space-x-2">
                  {series.genre.slice(0, 3).map((genre, index) => (
                    <span key={index} className="bg-gray-700/50 px-2 py-1 rounded text-sm">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayFirstEpisode}
                  className="bg-white text-black px-8 py-3 rounded-lg font-semibold flex items-center space-x-2 hover:bg-gray-200 transition-colors"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>Bắt Đầu Xem</span>
                </button>
                <button className="bg-gray-700/70 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600/70 transition-colors backdrop-blur-sm">
                  <Heart className="h-5 w-5" />
                </button>
                <button className="bg-gray-700/70 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600/70 transition-colors backdrop-blur-sm">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Description */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-white mb-4">Nội Dung Phim</h3>
            <div className="relative">
              <p className={`text-gray-300 leading-relaxed ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}>
                {series.description}
              </p>
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="mt-2 text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
              >
                <span>{isDescriptionExpanded ? 'Thu gọn' : 'Xem thêm'}</span>
                {isDescriptionExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 p-6 bg-gray-800/50 rounded-xl">
            <div className="text-center">
              <Calendar className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Năm phát hành</p>
              <p className="text-white font-semibold">{series.year}</p>
            </div>
            <div className="text-center">
              <Clock className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Tổng thời lượng</p>
              <p className="text-white font-semibold">{series.totalDuration}</p>
            </div>
            <div className="text-center">
              <User className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Đạo diễn</p>
              <p className="text-white font-semibold">{series.director}</p>
            </div>
            <div className="text-center">
              <Building className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Studio</p>
              <p className="text-white font-semibold">{series.studio}</p>
            </div>
          </div>

          {/* Episodes */}
          <EpisodeGrid 
            episodes={series.episodes} 
            onPlayEpisode={handlePlayEpisode}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SeriesDetailPage;