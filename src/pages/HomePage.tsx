import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Hero from '../components/Hero';
import MovieGrid from '../components/MovieGrid';
import WeeklySchedule from '../components/WeeklySchedule';
import AuthModal from '../components/AuthModal';
import VipModal from '../components/VipModal';
import PaymentModal from '../components/PaymentModal';
import AdminPanel from '../components/AdminPanel';
import Footer from '../components/Footer';
import { Movie, VipPlan } from '../types';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [selectedVipPlan, setSelectedVipPlan] = useState<VipPlan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Database series state
  const [dbSeries, setDbSeries] = useState<any[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(true);

  // Load series from database
  useEffect(() => {
    loadSeriesFromDB();
  }, []);

  const loadSeriesFromDB = async () => {
    try {
      setIsLoadingSeries(true);
      const response = await fetch('http://localhost:3001/api/series');
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Loaded series from database:', data.series);
        setDbSeries(data.series);
      } else {
        console.error('❌ Failed to load series:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading series:', error);
    } finally {
      setIsLoadingSeries(false);
    }
  };

  // Convert database series to Movie format for compatibility
  const convertDbSeriesToMovies = (dbSeriesData: any[]): Movie[] => {
    return dbSeriesData.map(series => ({
      id: series.id,
      title: series.title,
      titleVietnamese: series.titleVietnamese || series.title,
      description: series.description || '',
      year: series.year,
      duration: series.totalDuration || '24 phút/tập',
      rating: series.rating,
      genre: series.genre || [],
      director: series.director || '',
      studio: series.studio || '',
      thumbnail: series.thumbnail || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=400',
      banner: series.banner || 'https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg?auto=compress&cs=tinysrgb&w=1200',
      trailer: series.trailer || '',
      featured: series.featured || false,
      new: series.new || false,
      popular: series.popular || false,
      type: 'series' as const,
      episodeCount: series.episodeCount || 0,
      airDay: series.airDay as any,
      airTime: series.airTime
    }));
  };

  // Use database series instead of static data
  const allMovies = convertDbSeriesToMovies(dbSeries);

  // Filter movies based on search query
  const filteredMovies = useMemo(() => {
    if (!searchQuery.trim()) return allMovies;
    
    const query = searchQuery.toLowerCase();
    return allMovies.filter(movie => 
      movie.title.toLowerCase().includes(query) ||
      movie.titleVietnamese.includes(query) ||
      movie.genre.some(g => g.toLowerCase().includes(query)) ||
      movie.director.toLowerCase().includes(query)
    );
  }, [searchQuery, allMovies]);

  // Categorize movies
  const featuredMovies = filteredMovies.filter(movie => movie.featured);
  const newMovies = filteredMovies.filter(movie => movie.new);
  const scheduledMovies = filteredMovies.filter(movie => movie.airDay);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handlePlayMovie = async (movie: Movie) => {
    if (movie.type === 'series') {
      console.log(`🎬 Playing movie: "${movie.title}" → /series/${movie.id}/episode/1`);
      // Navigate to first episode
      navigate(`/series/${movie.id}/episode/1`);
    }
  };

  const handleShowDetails = async (movie: Movie) => {
    if (movie.type === 'series') {
      console.log(`📋 Showing details: "${movie.title}" → /series/${movie.id}`);
      navigate(`/series/${movie.id}`);
    }
  };

  const handleOpenAuth = () => {
    setIsAuthModalOpen(true);
  };

  const handleOpenVip = () => {
    setIsVipModalOpen(true);
  };

  const handleOpenAdmin = () => {
    setIsAdminPanelOpen(true);
  };

  const handleSelectVipPlan = (plan: VipPlan) => {
    setSelectedVipPlan(plan);
    setIsVipModalOpen(false);
    setIsPaymentModalOpen(true);
  };

  const handleClosePayment = () => {
    setIsPaymentModalOpen(false);
    setSelectedVipPlan(null);
  };

  const handleAdminPanelClose = () => {
    setIsAdminPanelOpen(false);
    // Reload series data when admin panel closes
    loadSeriesFromDB();
  };

  if (isLoadingSeries) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-xl">Đang tải dữ liệu từ database...</p>
          <p className="text-gray-400 text-sm mt-2">Kết nối với PostgreSQL...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header 
        onSearch={handleSearch} 
        onOpenAuth={handleOpenAuth} 
        onOpenVip={handleOpenVip}
        onOpenAdmin={handleOpenAdmin}
      />
      
      <main className="pt-16">
        {/* Hero Section - only show if no search query */}
        {!searchQuery && featuredMovies.length > 0 && (
          <Hero
            featuredMovies={featuredMovies}
            onPlayMovie={handlePlayMovie}
            onShowDetails={handleShowDetails}
          />
        )}

        {/* Content Sections */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
          {searchQuery ? (
            <MovieGrid
              title={`Kết quả tìm kiếm: "${searchQuery}" (${filteredMovies.length} kết quả)`}
              movies={filteredMovies}
              onPlayMovie={handlePlayMovie}
              onShowDetails={handleShowDetails}
            />
          ) : (
            <>
              {newMovies.length > 0 && (
                <MovieGrid
                  title="Mới Nhất 🔥"
                  movies={newMovies}
                  onPlayMovie={handlePlayMovie}
                  onShowDetails={handleShowDetails}
                />
              )}

              {scheduledMovies.length > 0 && (
                <WeeklySchedule
                  movies={scheduledMovies}
                  onPlayMovie={handlePlayMovie}
                  onShowDetails={handleShowDetails}
                />
              )}

              <MovieGrid
                title="Tất Cả Phim Hoạt Hình"
                movies={allMovies}
                onPlayMovie={handlePlayMovie}
                onShowDetails={handleShowDetails}
              />
            </>
          )}
        </div>
      </main>

      <Footer />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <VipModal
        isOpen={isVipModalOpen}
        onClose={() => setIsVipModalOpen(false)}
        onSelectPlan={handleSelectVipPlan}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={handleClosePayment}
        selectedPlan={selectedVipPlan}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={handleAdminPanelClose}
      />
    </div>
  );
};

export default HomePage;