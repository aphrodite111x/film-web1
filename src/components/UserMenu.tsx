import React, { useState } from 'react';
import { User, Crown, LogOut, Settings, Heart, History, ChevronDown, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserMenuProps {
  onOpenVip: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onOpenVip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        <img
          src={user.avatar || `https://images.pexels.com/photos/1000000/pexels-photo-1000000.jpeg?auto=compress&cs=tinysrgb&w=100`}
          alt={user.username}
          className="w-8 h-8 rounded-full object-cover"
        />
        <div className="hidden md:block text-left">
          <div className="flex items-center space-x-1">
            <span className="text-white text-sm font-medium">{user.username}</span>
            {user.isVip && <Crown className="h-4 w-4 text-yellow-400" />}
          </div>
          {user.isVip && (
            <span className="text-xs text-yellow-400">VIP Member</span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 rounded-xl shadow-xl border border-gray-700 z-50">
            {/* User Info */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <img
                  src={user.avatar || `https://images.pexels.com/photos/1000000/pexels-photo-1000000.jpeg?auto=compress&cs=tinysrgb&w=100`}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-white font-semibold">{user.username}</h3>
                    {user.isVip && <Crown className="h-4 w-4 text-yellow-400" />}
                    {user.isAdmin && <Star className="h-4 w-4 text-purple-400" />}
                  </div>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                  {user.isVip && user.vipExpiry && (
                    <p className="text-yellow-400 text-xs">
                      VIP đến {new Date(user.vipExpiry).toLocaleDateString('vi-VN')}
                    </p>
                  )}
                  {user.isAdmin && (
                    <p className="text-purple-400 text-xs">Administrator</p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {!user.isVip && (
                <button
                  onClick={() => {
                    onOpenVip();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors"
                >
                  <Crown className="h-5 w-5 text-yellow-400" />
                  <div>
                    <span className="text-white font-medium">Nâng cấp VIP</span>
                    <p className="text-yellow-400 text-xs">Xem video 4K chất lượng cao</p>
                  </div>
                </button>
              )}

              {user.isVip && (
                <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-l-4 border-yellow-400">
                  <div className="flex items-center space-x-2">
                    <Crown className="h-5 w-5 text-yellow-400" />
                    <span className="text-yellow-400 font-medium">VIP Active</span>
                  </div>
                  <p className="text-yellow-300 text-xs mt-1">
                    Đang xem với chất lượng 4K
                  </p>
                </div>
              )}

              <button className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors">
                <Heart className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">Yêu thích</span>
              </button>

              <button className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors">
                <History className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">Lịch sử xem</span>
              </button>

              <button className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors">
                <Settings className="h-5 w-5 text-gray-400" />
                <span className="text-gray-300">Cài đặt</span>
              </button>

              <div className="border-t border-gray-700 mt-2 pt-2">
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-700 transition-colors text-red-400"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;