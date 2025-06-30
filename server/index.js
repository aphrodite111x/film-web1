import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Configure FFmpeg paths
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  console.log(`🎬 FFmpeg path set to: ${process.env.FFMPEG_PATH}`);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  console.log(`🔍 FFprobe path set to: ${process.env.FFPROBE_PATH}`);
}

// Enhanced CORS configuration for HLS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const BASE_DIR = path.resolve(__dirname, process.env.BASE_DIR || 'videos');
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads');
const SEGMENTS_DIR = path.resolve(__dirname, process.env.SEGMENTS_DIR || 'segments');

await fs.ensureDir(BASE_DIR);
await fs.ensureDir(UPLOAD_DIR);
await fs.ensureDir(SEGMENTS_DIR);

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
try {
  const client = await pool.connect();
  console.log('✅ Connected to PostgreSQL database');
  client.release();
} catch (error) {
  console.error('❌ PostgreSQL connection error:', error);
  console.log('💡 Please run: npm run setup-db');
  process.exit(1);
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Optional auth middleware (doesn't require token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Vietnamese diacritics removal for folder names
const removeVietnameseDiacritics = (str) => {
  const diacriticsMap = {
    'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
    'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
    'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
    'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
    'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
    'đ': 'd',
    'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A', 'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
    'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
    'Đ': 'D'
  };

  return str.replace(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, (match) => diacriticsMap[match] || match);
};

const createSeriesSlug = (title) => {
  return removeVietnameseDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
};

// HLS static file serving
app.use('/segments', express.static(SEGMENTS_DIR, {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// ===== AUTH ENDPOINTS =====

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;

  try {
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, is_vip, is_admin, created_at',
      [email, username, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVip: user.is_vip,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, email, username, password_hash, is_vip, is_admin, vip_expiry, avatar FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    // Check VIP expiry
    let isVip = user.is_vip;
    if (user.vip_expiry && new Date(user.vip_expiry) < new Date()) {
      isVip = false;
      await pool.query('UPDATE users SET is_vip = false WHERE id = $1', [user.id]);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, isAdmin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVip: isVip,
        isAdmin: user.is_admin,
        vipExpiry: user.vip_expiry,
        avatar: user.avatar
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, is_vip, is_admin, vip_expiry, avatar, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVip: user.is_vip,
        isAdmin: user.is_admin,
        vipExpiry: user.vip_expiry,
        avatar: user.avatar,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// ===== FAVORITES ENDPOINTS =====

// Get user favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, f.created_at as favorited_at
      FROM favorites f
      JOIN series s ON f.series_id = s.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [req.user.userId]);

    res.json({
      success: true,
      favorites: result.rows
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ success: false, error: 'Failed to get favorites' });
  }
});

// Add to favorites
app.post('/api/favorites/:seriesId', authenticateToken, async (req, res) => {
  const { seriesId } = req.params;

  try {
    await pool.query(
      'INSERT INTO favorites (user_id, series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.userId, seriesId]
    );

    res.json({ success: true, message: 'Added to favorites' });

  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ success: false, error: 'Failed to add favorite' });
  }
});

// Remove from favorites
app.delete('/api/favorites/:seriesId', authenticateToken, async (req, res) => {
  const { seriesId } = req.params;

  try {
    await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND series_id = $2',
      [req.user.userId, seriesId]
    );

    res.json({ success: true, message: 'Removed from favorites' });

  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove favorite' });
  }
});

// ===== RATINGS ENDPOINTS =====

// Rate series/episode
app.post('/api/ratings', authenticateToken, async (req, res) => {
  const { seriesId, episodeId, rating } = req.body;

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
  }

  try {
    await pool.query(
      `INSERT INTO ratings (user_id, series_id, episode_id, rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, series_id, episode_id)
       DO UPDATE SET rating = EXCLUDED.rating, updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, seriesId, episodeId, rating]
    );

    // Update average rating for series
    const avgResult = await pool.query(
      'SELECT AVG(rating) as avg_rating FROM ratings WHERE series_id = $1 AND episode_id IS NULL',
      [seriesId]
    );

    if (avgResult.rows[0].avg_rating) {
      await pool.query(
        'UPDATE series SET rating = $1 WHERE id = $2',
        [parseFloat(avgResult.rows[0].avg_rating), seriesId]
      );
    }

    res.json({ success: true, message: 'Rating saved' });

  } catch (error) {
    console.error('Rating error:', error);
    res.status(500).json({ success: false, error: 'Failed to save rating' });
  }
});

// ===== COMMENTS ENDPOINTS =====

// Get comments for series/episode
app.get('/api/comments/:seriesId', optionalAuth, async (req, res) => {
  const { seriesId } = req.params;
  const { episodeId } = req.query;

  try {
    const result = await pool.query(`
      SELECT c.*, u.username, u.avatar,
             (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.series_id = $1 AND ($2::uuid IS NULL OR c.episode_id = $2)
      AND c.parent_id IS NULL
      ORDER BY c.created_at DESC
    `, [seriesId, episodeId || null]);

    res.json({
      success: true,
      comments: result.rows
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get comments' });
  }
});

// Add comment
app.post('/api/comments', authenticateToken, async (req, res) => {
  const { seriesId, episodeId, content, rating, parentId } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO comments (user_id, series_id, episode_id, content, rating, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [req.user.userId, seriesId, episodeId || null, content, rating || null, parentId || null]
    );

    res.json({
      success: true,
      comment: result.rows[0]
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

// ===== WATCH PROGRESS ENDPOINTS =====

// Update watch progress
app.post('/api/progress', authenticateToken, async (req, res) => {
  const { videoId, seriesId, episodeId, progress, duration } = req.body;

  const validDuration = Math.max(parseFloat(duration) || 1, 1);
  const validProgress = Math.max(parseFloat(progress) || 0, 0);
  const percentage = Math.min((validProgress / validDuration) * 100, 100);

  try {
    await pool.query(
      `INSERT INTO watch_progress (user_id, video_id, series_id, episode_id, progress, duration, percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, video_id)
       DO UPDATE SET 
         progress = EXCLUDED.progress,
         duration = EXCLUDED.duration,
         percentage = EXCLUDED.percentage,
         last_watched_at = CURRENT_TIMESTAMP`,
      [req.user.userId, videoId, seriesId, episodeId, validProgress, validDuration, percentage]
    );

    res.json({ success: true, message: 'Progress updated' });

  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update progress' });
  }
});

// Get watch history
app.get('/api/watch-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT wp.*, s.title as series_title, s.thumbnail as series_thumbnail,
             e.number as episode_number, e.title as episode_title
      FROM watch_progress wp
      JOIN series s ON wp.series_id = s.id
      LEFT JOIN episodes e ON wp.episode_id = e.id
      WHERE wp.user_id = $1
      ORDER BY wp.last_watched_at DESC
      LIMIT 50
    `, [req.user.userId]);

    res.json({
      success: true,
      history: result.rows
    });

  } catch (error) {
    console.error('Get watch history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get watch history' });
  }
});

// ===== VIP ENDPOINTS =====

// Upgrade to VIP
app.post('/api/vip/upgrade', authenticateToken, async (req, res) => {
  const { planId, paymentMethod, transactionCode } = req.body;

  const plans = {
    'monthly': { duration: 1, price: 99000 },
    'quarterly': { duration: 3, price: 249000 },
    'yearly': { duration: 12, price: 799000 }
  };

  const plan = plans[planId];
  if (!plan) {
    return res.status(400).json({ success: false, error: 'Invalid plan' });
  }

  try {
    // Calculate VIP expiry
    const currentDate = new Date();
    const vipExpiry = new Date(currentDate.setMonth(currentDate.getMonth() + plan.duration));

    // Update user VIP status
    await pool.query(
      'UPDATE users SET is_vip = true, vip_expiry = $1 WHERE id = $2',
      [vipExpiry, req.user.userId]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO vip_transactions (user_id, plan_id, amount, payment_method, status, transaction_code, confirmed_at)
       VALUES ($1, $2, $3, $4, 'confirmed', $5, CURRENT_TIMESTAMP)`,
      [req.user.userId, planId, plan.price, paymentMethod, transactionCode]
    );

    res.json({
      success: true,
      message: 'VIP upgrade successful',
      vipExpiry: vipExpiry
    });

  } catch (error) {
    console.error('VIP upgrade error:', error);
    res.status(500).json({ success: false, error: 'VIP upgrade failed' });
  }
});

// ===== VIDEO ENDPOINTS WITH VIP SUPPORT =====

// Get videos by series slug and episode number (with VIP quality)
app.get('/api/videos/:seriesSlug/:episodeNumber', optionalAuth, async (req, res) => {
  const { seriesSlug, episodeNumber } = req.params;
  
  try {
    // Find series by slug
    const seriesResult = await pool.query('SELECT id, title FROM series');
    const allSeries = seriesResult.rows;
    
    let foundSeries = null;
    for (const series of allSeries) {
      const generatedSlug = createSeriesSlug(series.title);
      if (generatedSlug.toLowerCase() === seriesSlug.toLowerCase()) {
        foundSeries = series;
        break;
      }
    }

    if (!foundSeries) {
      return res.status(404).json({ 
        success: false, 
        error: `Series not found for slug: ${seriesSlug}` 
      });
    }

    // Find video
    const videoResult = await pool.query(
      'SELECT * FROM videos WHERE series_id = $1 AND episode_number = $2 AND status = $3',
      [foundSeries.id, parseInt(episodeNumber), 'completed']
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found or not ready' 
      });
    }

    const video = videoResult.rows[0];
    const episodeFolderName = `tap-${video.episode_number.toString().padStart(2, '0')}`;
    
    // Determine quality based on user VIP status
    const isVip = req.user && req.user.isVip;
    const hlsUrl = isVip && video.hls_manifest_path_4k 
      ? `/segments/${seriesSlug}/${episodeFolderName}/playlist_4k.m3u8`
      : `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;

    res.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration,
        hlsUrl: hlsUrl,
        quality: isVip && video.hls_manifest_path_4k ? '4K' : '1080p',
        status: video.status,
        totalSegments: isVip && video.total_segments_4k ? video.total_segments_4k : video.total_segments
      }
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Continue with existing endpoints...
// (Keep all the existing series, episodes, upload endpoints from the original file)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AnimeStream Video Server',
    version: '6.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    features: [
      'User Authentication & Registration',
      'VIP System with 4K Quality',
      'Favorites & Ratings',
      'Comments & Reviews',
      'Watch History & Progress',
      'Video Upload & HLS Streaming',
      'Admin Panel'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AnimeStream Video Server v6.0.0 running on http://localhost:${PORT}`);
  console.log(`🔐 JWT Authentication enabled`);
  console.log(`👑 VIP System with 4K quality support`);
  console.log(`💾 Full user features: favorites, ratings, comments, history`);
});