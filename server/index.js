import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import pg from 'pg';
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

// Configure FFmpeg paths
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  console.log(`🎬 FFmpeg path set to: ${process.env.FFMPEG_PATH}`);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  console.log(`🔍 FFprobe path set to: ${process.env.FFPROBE_PATH}`);
}

// Test FFmpeg installation
try {
  ffmpeg.getAvailableFormats((err, formats) => {
    if (err) {
      console.error('❌ FFmpeg test failed:', err.message);
      console.log('💡 Please check your FFmpeg installation and paths in .env file');
    } else {
      console.log('✅ FFmpeg is working correctly');
    }
  });
} catch (error) {
  console.error('❌ FFmpeg configuration error:', error.message);
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

// Directories - ORGANIZED STRUCTURE
const BASE_DIR = path.resolve(__dirname, process.env.BASE_DIR || 'videos');
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || 'uploads');
const SEGMENTS_DIR = path.resolve(__dirname, process.env.SEGMENTS_DIR || 'segments');

// Ensure directories exist
await fs.ensureDir(BASE_DIR);
await fs.ensureDir(UPLOAD_DIR);
await fs.ensureDir(SEGMENTS_DIR);

console.log('📁 Directories initialized:');
console.log(`   Base: ${BASE_DIR}`);
console.log(`   Upload: ${UPLOAD_DIR}`);
console.log(`   Segments: ${SEGMENTS_DIR}`);

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

// Rate limiting for API requests
const requestTracker = new Map();

const rateLimit = (maxRequests = 10, windowMs = 60000) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requestTracker.has(clientIP)) {
      requestTracker.set(clientIP, []);
    }
    
    const requests = requestTracker.get(clientIP);
    
    // Clean old requests
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    requestTracker.set(clientIP, validRequests);
    
    next();
  };
};

// FIXED: Vietnamese diacritics removal for folder names
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

// Create series slug for folder names
const createSeriesSlug = (title) => {
  return removeVietnameseDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Create segments path using series title slug
const createSegmentsPath = (seriesTitle, episodeNumber) => {
  const seriesSlug = createSeriesSlug(seriesTitle);
  const episodeFolderName = `tap-${episodeNumber.toString().padStart(2, '0')}`;
  const segmentsPath = path.join(SEGMENTS_DIR, seriesSlug, episodeFolderName);
  
  console.log(`🔗 Segments path: "${seriesTitle}" → ${seriesSlug}/${episodeFolderName}`);
  console.log(`📁 Full path: ${segmentsPath}`);
  
  return segmentsPath;
};

// CRITICAL: Enhanced HLS static file serving with proper headers
app.use('/segments', express.static(SEGMENTS_DIR, {
  setHeaders: (res, filePath) => {
    // Set CORS headers for all files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    if (filePath.endsWith('.m3u8')) {
      // HLS Manifest files
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      console.log(`📋 Serving HLS manifest: ${path.basename(filePath)}`);
    } else if (filePath.endsWith('.ts')) {
      // HLS Segment files
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache segments for 1 year
      res.setHeader('Accept-Ranges', 'bytes');
      console.log(`📦 Serving HLS segment: ${path.basename(filePath)}`);
    }
  }
}));

// Apply rate limiting to progress API
app.use('/api/progress', rateLimit(5, 60000)); // 5 requests per minute

// Utility functions
const createSafeFilename = (originalName) => {
  const timestamp = Date.now();
  const uuid = uuidv4().split('-')[0];
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);
  return `${timestamp}_${uuid}_${baseName}${ext}`;
};

const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('❌ FFprobe error:', err);
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        const size = metadata.format.size || 0;
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        resolve({ 
          duration, 
          size,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          videoCodec: videoStream?.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'unknown',
          bitrate: metadata.format.bit_rate || 0
        });
      }
    });
  });
};

// Enhanced multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeFilename = createSafeFilename(file.originalname);
    cb(null, safeFilename);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 * 1024, // 10GB default
    fieldSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 File upload attempt:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`));
    }
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AnimeStream Video Server',
    version: '5.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL',
    ffmpeg: {
      path: process.env.FFMPEG_PATH || 'system',
      status: 'configured'
    },
    features: ['Video Upload', 'FFmpeg HLS Segmentation', 'HLS.js Compatible', 'Watch Progress', 'Database Management', 'ID-Based URL Structure'],
    endpoints: {
      // Series management
      getAllSeries: 'GET /api/series',
      createSeries: 'POST /api/series',
      updateSeries: 'PUT /api/series/:id',
      deleteSeries: 'DELETE /api/series/:id',
      
      // Episode management
      getEpisodes: 'GET /api/series/:seriesId/episodes',
      createEpisode: 'POST /api/series/:seriesId/episodes',
      updateEpisode: 'PUT /api/episodes/:id',
      deleteEpisode: 'DELETE /api/episodes/:id',
      
      // Video management
      uploadVideo: 'POST /api/upload-video',
      getVideo: 'GET /api/video/:videoId',
      getVideoByIdAndEpisode: 'GET /api/videos/:seriesId/:episodeNumber',
      getAllVideos: 'GET /api/videos/all',
      deleteVideo: 'DELETE /api/video/:videoId',
      
      // Streaming
      hlsManifest: 'GET /segments/{series-slug}/tap-XX/playlist.m3u8',
      hlsSegment: 'GET /segments/{series-slug}/tap-XX/segment_XXX.ts',
      
      // Progress
      updateProgress: 'POST /api/progress',
      getProgress: 'GET /api/progress/:userId/:videoId'
    }
  });
});

// ===== SERIES MANAGEMENT ENDPOINTS =====

// Get all series with episodes info
app.get('/api/series', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, 
             COUNT(e.id) as actual_episode_count,
             COUNT(v.id) as videos_count
      FROM series s
      LEFT JOIN episodes e ON s.id = e.series_id
      LEFT JOIN videos v ON s.id = v.series_id AND v.status = 'completed'
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    const series = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      titleVietnamese: row.title_vietnamese,
      description: row.description,
      year: row.year,
      rating: row.rating,
      genre: row.genre || [],
      director: row.director,
      studio: row.studio,
      thumbnail: row.thumbnail,
      banner: row.banner,
      trailer: row.trailer,
      featured: row.featured,
      new: row.new,
      popular: row.popular,
      episodeCount: parseInt(row.actual_episode_count) || 0,
      totalDuration: row.total_duration,
      status: row.status,
      airDay: row.air_day,
      airTime: row.air_time,
      videosCount: parseInt(row.videos_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      series
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create new series
app.post('/api/series', async (req, res) => {
  const {
    title,
    titleVietnamese,
    description,
    year,
    rating,
    genre,
    director,
    studio,
    thumbnail,
    banner,
    trailer,
    featured,
    new: isNew,
    popular,
    totalDuration,
    status,
    airDay,
    airTime
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO series (
        title, title_vietnamese, description, year, rating, genre,
        director, studio, thumbnail, banner, trailer, featured,
        new, popular, total_duration, status, air_day, air_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      title, titleVietnamese, description, year, rating, genre || [],
      director, studio, thumbnail, banner, trailer, featured || false,
      isNew || false, popular || false, totalDuration, status || 'ongoing',
      airDay, airTime
    ]);

    res.json({
      success: true,
      series: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Create series error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update series
app.put('/api/series/:id', async (req, res) => {
  const { id } = req.params;
  const updateFields = req.body;

  try {
    // Build dynamic update query
    const setClause = Object.keys(updateFields)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [id, ...Object.values(updateFields)];

    const result = await pool.query(`
      UPDATE series 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Series not found' 
      });
    }

    res.json({
      success: true,
      series: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Update series error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete series
app.delete('/api/series/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete series (cascade will handle episodes and videos)
    const result = await pool.query('DELETE FROM series WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Series not found' 
      });
    }

    res.json({
      success: true,
      message: 'Series deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete series error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== EPISODE MANAGEMENT ENDPOINTS =====

// Get episodes for a series with video info
app.get('/api/series/:seriesId/episodes', async (req, res) => {
  const { seriesId } = req.params;

  try {
    const result = await pool.query(`
      SELECT e.*, 
             v.id as video_id,
             v.status as video_status,
             v.hls_manifest_path,
             v.duration as video_duration,
             s.title as series_title
      FROM episodes e
      LEFT JOIN videos v ON e.series_id = v.series_id AND e.number = v.episode_number AND v.status = 'completed'
      LEFT JOIN series s ON e.series_id = s.id
      WHERE e.series_id = $1
      ORDER BY e.number ASC
    `, [seriesId]);

    const episodes = result.rows.map(row => {
      // Create HLS URL using series title slug
      let hlsUrl = null;
      if (row.hls_manifest_path && row.series_title) {
        const seriesSlug = createSeriesSlug(row.series_title);
        const episodeFolderName = `tap-${row.number.toString().padStart(2, '0')}`;
        hlsUrl = `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;
      }

      return {
        id: row.id,
        seriesId: row.series_id,
        number: row.number,
        title: row.title,
        titleVietnamese: row.title_vietnamese,
        description: row.description,
        duration: row.duration,
        thumbnail: row.thumbnail,
        releaseDate: row.release_date,
        rating: row.rating,
        watched: row.watched,
        watchProgress: row.watch_progress,
        lastWatchedAt: row.last_watched_at,
        guestCast: row.guest_cast,
        directorNotes: row.director_notes,
        hasBehindScenes: row.has_behind_scenes,
        hasCommentary: row.has_commentary,
        sourceUrl: row.source_url,
        hasVideo: !!row.video_id,
        videoStatus: row.video_status,
        hlsUrl: hlsUrl,
        videoId: row.video_id,
        videoDuration: row.video_duration
      };
    });

    res.json({
      success: true,
      episodes
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create new episode
app.post('/api/series/:seriesId/episodes', async (req, res) => {
  const { seriesId } = req.params;
  const {
    number,
    title,
    titleVietnamese,
    description,
    duration,
    thumbnail,
    releaseDate,
    rating
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO episodes (
        series_id, number, title, title_vietnamese, description,
        duration, thumbnail, release_date, rating
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      seriesId, number, title, titleVietnamese, description,
      duration, thumbnail, releaseDate, rating || 0
    ]);

    // Update series episode count
    await pool.query(`
      UPDATE series 
      SET episode_count = (SELECT COUNT(*) FROM episodes WHERE series_id = $1)
      WHERE id = $1
    `, [seriesId]);

    res.json({
      success: true,
      episode: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Create episode error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload video endpoint
app.post('/api/upload-video', upload.single('video'), async (req, res) => {
  console.log('🎬 Video upload request received');
  console.log('📋 Request body:', req.body);
  console.log('📁 File info:', req.file);

  const client = await pool.connect();
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No video file uploaded'
      });
    }

    const { seriesId, episodeNumber, title } = req.body;
    
    if (!seriesId || !episodeNumber || !title) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: seriesId, episodeNumber, title'
      });
    }

    // Get series title for folder structure
    const seriesResult = await client.query('SELECT title FROM series WHERE id = $1', [seriesId]);
    if (seriesResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Series not found'
      });
    }

    const seriesTitle = seriesResult.rows[0].title;
    const uploadedFile = req.file;
    const uploadedPath = uploadedFile.path;

    console.log(`📹 Processing video: ${title} for series: ${seriesTitle}`);
    console.log(`📊 File: ${uploadedFile.originalname} (${uploadedFile.size} bytes)`);

    // Create segments path using series title
    const segmentsPath = createSegmentsPath(seriesTitle, parseInt(episodeNumber));
    await fs.ensureDir(segmentsPath);

    // Move uploaded file to segments directory for processing
    const finalVideoPath = path.join(segmentsPath, `video${path.extname(uploadedFile.originalname)}`);
    await fs.move(uploadedPath, finalVideoPath);

    console.log(`📁 Video moved to: ${finalVideoPath}`);
    console.log(`📁 Segments will be stored in: ${segmentsPath}`);

    // Get video metadata using FFmpeg
    console.log('🔍 Analyzing video with FFmpeg...');
    const metadata = await getVideoMetadata(finalVideoPath);
    
    console.log(`⏱️  Duration: ${metadata.duration}s`);
    console.log(`📐 Resolution: ${metadata.width}x${metadata.height}`);
    console.log(`🎥 Video Codec: ${metadata.videoCodec}`);
    console.log(`🔊 Audio Codec: ${metadata.audioCodec}`);

    // Get episode_id if exists
    const episodeResult = await client.query(
      'SELECT id FROM episodes WHERE series_id = $1 AND number = $2',
      [seriesId, parseInt(episodeNumber)]
    );

    const episodeId = episodeResult.rows.length > 0 ? episodeResult.rows[0].id : null;

    // Insert video record into PostgreSQL
    const insertVideoQuery = `
      INSERT INTO videos (
        title, series_id, episode_id, episode_number, original_filename, safe_filename,
        duration, file_size, video_path, status, series_title
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const result = await client.query(insertVideoQuery, [
      title,
      seriesId,
      episodeId,
      parseInt(episodeNumber),
      uploadedFile.originalname,
      uploadedFile.filename,
      metadata.duration,
      metadata.size,
      finalVideoPath,
      'processing',
      seriesTitle // Store series title for folder structure
    ]);

    const videoId = result.rows[0].id;
    console.log(`💾 Video saved to PostgreSQL with ID: ${videoId}`);

    // Start FFmpeg processing in background
    console.log('🔄 Starting FFmpeg HLS segmentation...');
    processVideoWithFFmpeg(videoId, finalVideoPath, segmentsPath, metadata.duration, seriesTitle, parseInt(episodeNumber));

    res.json({
      success: true,
      videoId,
      message: 'Video uploaded successfully. FFmpeg HLS processing started...',
      metadata: {
        duration: Math.floor(metadata.duration),
        fileSize: metadata.size,
        resolution: `${metadata.width}x${metadata.height}`,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec,
        estimatedSegments: Math.ceil(metadata.duration / 6),
        originalFilename: uploadedFile.originalname,
        safeFilename: uploadedFile.filename,
        videoPath: finalVideoPath,
        segmentsPath: segmentsPath,
        seriesTitle: seriesTitle
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// FFmpeg HLS processing with series-based folder structure
async function processVideoWithFFmpeg(videoId, videoPath, segmentsPath, duration, seriesTitle, episodeNumber) {
  const client = await pool.connect();
  
  try {
    console.log(`🎬 Starting FFmpeg HLS processing for video ${videoId}`);
    console.log(`📁 Input: ${videoPath}`);
    console.log(`📁 Output: ${segmentsPath}`);
    console.log(`📺 Series: ${seriesTitle}, Episode: ${episodeNumber}`);

    const hlsManifestPath = path.join(segmentsPath, 'playlist.m3u8');
    const segmentPattern = path.join(segmentsPath, 'segment_%03d.ts');

    // Update status to processing
    await client.query(
      'UPDATE videos SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['processing', videoId]
    );

    console.log(`🔧 FFmpeg HLS segmentation: 6s segments, browser-compatible`);
    console.log(`📁 Manifest: ${hlsManifestPath}`);
    console.log(`📁 Segment pattern: ${segmentPattern}`);
    
    await new Promise((resolve, reject) => {
      // OPTIMIZED FFmpeg command for browser compatibility
      const command = ffmpeg(videoPath)
        // Video settings - browser compatible
        .videoCodec('libx264')           // H.264 codec (widely supported)
        .audioCodec('aac')               // AAC audio (widely supported)
        .addOption('-preset', 'fast')    // Encoding speed
        .addOption('-crf', '23')         // Quality (lower = better)
        .addOption('-profile:v', 'baseline') // H.264 baseline profile (max compatibility)
        .addOption('-level', '3.0')      // H.264 level 3.0 (mobile compatible)
        .addOption('-pix_fmt', 'yuv420p') // Pixel format (widely supported)
        
        // Audio settings
        .addOption('-ar', '44100')       // Audio sample rate
        .addOption('-ac', '2')           // Stereo audio
        .addOption('-b:a', '128k')       // Audio bitrate
        
        // HLS settings
        .addOption('-f', 'hls')          // HLS format
        .addOption('-hls_time', '6')     // 6-second segments
        .addOption('-hls_list_size', '0') // Keep all segments
        .addOption('-hls_segment_type', 'mpegts') // MPEG-TS segments
        .addOption('-hls_segment_filename', segmentPattern)
        .addOption('-hls_flags', 'independent_segments+program_date_time')
        
        // Keyframe settings for better seeking
        .addOption('-g', '48')           // GOP size (keyframe every 48 frames = 2 seconds at 24fps)
        .addOption('-keyint_min', '48')  // Min keyframe interval
        .addOption('-sc_threshold', '0') // Disable scene change detection
        
        // Output
        .output(hlsManifestPath)
        .on('start', (commandLine) => {
          console.log('🎬 FFmpeg command:', commandLine);
        })
        .on('progress', async (progress) => {
          const percent = Math.round(progress.percent || 0);
          if (percent > 0 && percent <= 100) {
            console.log(`⏳ Processing: ${percent}% (${progress.timemark}) - Speed: ${progress.currentKbps || 0}kbps`);
            
            // Update progress in database (throttled)
            if (percent % 10 === 0) { // Update every 10%
              try {
                await client.query(
                  'UPDATE videos SET processing_progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                  [percent, videoId]
                );
              } catch (dbError) {
                console.error('❌ Progress update error:', dbError);
              }
            }
          }
        })
        .on('end', async () => {
          console.log('✅ FFmpeg HLS processing completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        });

      // Start the conversion
      command.run();
    });

    // Read generated segments and save to database
    console.log('📊 Reading generated HLS segments...');
    const segmentFiles = await fs.readdir(segmentsPath);
    const tsFiles = segmentFiles.filter(file => file.endsWith('.ts')).sort();

    console.log(`📁 Found ${tsFiles.length} HLS segment files`);

    // Verify manifest file exists and is valid
    const manifestExists = await fs.pathExists(hlsManifestPath);
    if (!manifestExists) {
      throw new Error('HLS manifest file was not created');
    }

    // Read and validate manifest
    const manifestContent = await fs.readFile(hlsManifestPath, 'utf8');
    console.log('📋 HLS Manifest preview:');
    console.log(manifestContent.split('\n').slice(0, 10).join('\n'));

    // Clear existing segments for this video
    await client.query('DELETE FROM segments WHERE video_id = $1', [videoId]);

    for (let i = 0; i < tsFiles.length; i++) {
      const filename = tsFiles[i];
      const filePath = path.join(segmentsPath, filename);
      const stats = await fs.stat(filePath);
      
      // Calculate segment duration (approximate)
      const segmentDur = i === tsFiles.length - 1 
        ? duration - (i * 6) // Last segment might be shorter
        : 6;

      await client.query(
        `INSERT INTO segments (video_id, segment_number, filename, file_path, duration, file_size)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [videoId, i + 1, filename, filePath, segmentDur, stats.size]
      );
    }

    // Create HLS URL using series slug
    const seriesSlug = createSeriesSlug(seriesTitle);
    const episodeFolderName = `tap-${episodeNumber.toString().padStart(2, '0')}`;
    const hlsUrl = `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;

    // Update video status to completed
    await client.query(
      `UPDATE videos SET 
        status = $1, 
        hls_manifest_path = $2, 
        total_segments = $3,
        processing_progress = 100,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      ['completed', hlsManifestPath, tsFiles.length, videoId]
    );

    console.log(`🎉 Video ${videoId} HLS processing completed successfully!`);
    console.log(`📁 HLS manifest: ${hlsManifestPath}`);
    console.log(`📊 Total segments: ${tsFiles.length}`);
    console.log(`🌐 HLS URL: http://localhost:3001${hlsUrl}`);
    console.log(`🎯 Browser compatible: H.264 Baseline + AAC + HLS.js ready`);
    console.log(`📁 Folder structure: ${seriesSlug}/${episodeFolderName}/`);

  } catch (error) {
    console.error('❌ FFmpeg processing error:', error);
    
    // Update status to failed
    await client.query(
      'UPDATE videos SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['failed', videoId]
    );
  } finally {
    client.release();
  }
}

// Get all videos for admin panel
app.get('/api/videos/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        v.id, v.title, v.series_id, v.episode_number, v.original_filename, v.safe_filename,
        v.duration, v.file_size, v.video_path, v.hls_manifest_path, v.status, 
        v.processing_progress, v.total_segments, v.created_at, v.updated_at, v.series_title,
        s.title as series_title_current, s.title_vietnamese as series_title_vietnamese
      FROM videos v
      LEFT JOIN series s ON v.series_id = s.id
      ORDER BY v.created_at DESC
    `);

    const videos = result.rows.map(video => {
      // Create HLS URL using series title slug
      let hlsUrl = null;
      if (video.hls_manifest_path && video.status === 'completed') {
        const seriesTitle = video.series_title || video.series_title_current;
        if (seriesTitle) {
          const seriesSlug = createSeriesSlug(seriesTitle);
          const episodeFolderName = `tap-${video.episode_number.toString().padStart(2, '0')}`;
          hlsUrl = `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;
        }
      }

      return {
        ...video,
        hlsUrl: hlsUrl,
        uploadedAt: video.created_at,
        seriesTitle: video.series_title_current,
        seriesTitleVietnamese: video.series_title_vietnamese
      };
    });

    res.json({
      success: true,
      videos
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete video endpoint
app.delete('/api/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  console.log(`🗑️ Delete request for video: ${videoId}`);

  const client = await pool.connect();
  
  try {
    // Get video info first
    const videoResult = await client.query(
      'SELECT * FROM videos WHERE id = $1',
      [videoId]
    );

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found' 
      });
    }

    const video = videoResult.rows[0];
    console.log(`📹 Found video: ${video.title}`);

    // Delete from database first (with cascade to segments)
    await client.query('DELETE FROM videos WHERE id = $1', [videoId]);
    console.log('✅ Video deleted from database');

    // Delete physical files
    try {
      // Delete the video file
      if (video.video_path && await fs.pathExists(video.video_path)) {
        await fs.remove(video.video_path);
        console.log(`🗑️ Deleted video file: ${video.video_path}`);
      }

      // Delete HLS segments directory
      if (video.hls_manifest_path) {
        const segmentsDir = path.dirname(video.hls_manifest_path);
        if (await fs.pathExists(segmentsDir)) {
          await fs.remove(segmentsDir);
          console.log(`🗑️ Deleted segments directory: ${segmentsDir}`);
        }
      }

    } catch (fileError) {
      console.error('⚠️ Error deleting files:', fileError);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Video and associated files deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// Get video info
app.get('/api/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  console.log(`📹 Getting video info for: ${videoId}`);

  try {
    const result = await pool.query(
      'SELECT v.*, s.title as series_title_current FROM videos v LEFT JOIN series s ON v.series_id = s.id WHERE v.id = $1',
      [videoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found' 
      });
    }

    const video = result.rows[0];
    console.log(`✅ Video found: ${video.title} (${video.status})`);

    // Create HLS URL using series title slug
    let hlsUrl = null;
    if (video.status === 'completed' && video.hls_manifest_path) {
      const seriesTitle = video.series_title || video.series_title_current;
      if (seriesTitle) {
        const seriesSlug = createSeriesSlug(seriesTitle);
        const episodeFolderName = `tap-${video.episode_number.toString().padStart(2, '0')}`;
        hlsUrl = `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;
      }
    }

    res.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        seriesId: video.series_id,
        episodeNumber: video.episode_number,
        duration: video.duration,
        fileSize: video.file_size,
        status: video.status,
        processingProgress: video.processing_progress,
        totalSegments: video.total_segments,
        hlsUrl: hlsUrl,
        createdAt: video.created_at,
        updatedAt: video.updated_at
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

// FIXED: Get videos by series ID and episode number (instead of slug)
app.get('/api/videos/:seriesId/:episodeNumber', async (req, res) => {
  const { seriesId, episodeNumber } = req.params;
  
  console.log(`🔍 Looking for video: series ID "${seriesId}", episode ${episodeNumber}`);

  try {
    // Find video by series ID and episode number
    const videoResult = await pool.query(`
      SELECT v.*, s.title as series_title_current 
      FROM videos v 
      LEFT JOIN series s ON v.series_id = s.id 
      WHERE v.series_id = $1 AND v.episode_number = $2 AND v.status = $3
    `, [seriesId, parseInt(episodeNumber), 'completed']);

    if (videoResult.rows.length === 0) {
      console.log(`❌ No video found for series ${seriesId} episode ${episodeNumber}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Video not found or not ready' 
      });
    }

    const video = videoResult.rows[0];
    console.log(`✅ Found video: ${video.title} (ID: ${video.id})`);

    // Create HLS URL using series title slug
    const seriesTitle = video.series_title || video.series_title_current;
    let hlsUrl = null;
    
    if (seriesTitle) {
      const seriesSlug = createSeriesSlug(seriesTitle);
      const episodeFolderName = `tap-${video.episode_number.toString().padStart(2, '0')}`;
      hlsUrl = `/segments/${seriesSlug}/${episodeFolderName}/playlist.m3u8`;
      console.log(`🎬 Generated HLS URL: ${hlsUrl}`);
    }

    res.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration,
        hlsUrl: hlsUrl,
        status: video.status,
        totalSegments: video.total_segments
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

// Update watch progress - FIXED validation
app.post('/api/progress', async (req, res) => {
  const { userId, videoId, progress, duration } = req.body;
  
  // Validate input data
  if (!userId || !videoId || progress === undefined || duration === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: userId, videoId, progress, duration'
    });
  }

  // Ensure duration is not null or zero
  const validDuration = Math.max(parseFloat(duration) || 1, 1); // Minimum 1 second
  const validProgress = Math.max(parseFloat(progress) || 0, 0);
  const percentage = Math.min((validProgress / validDuration) * 100, 100);

  // Throttle logging
  const logKey = `progress-${userId}-${videoId}`;
  const now = Date.now();
  const lastLog = requestTracker.get(logKey) || 0;
  
  if (now - lastLog > 30000) { // Only log every 30 seconds
    console.log(`📊 Updating progress: User ${userId}, Video ${videoId}, ${percentage.toFixed(1)}% (${validProgress}/${validDuration}s)`);
    requestTracker.set(logKey, now);
  }

  try {
    await pool.query(
      `INSERT INTO watch_progress (user_id, video_id, progress, duration, percentage, last_watched_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, video_id) 
       DO UPDATE SET 
         progress = EXCLUDED.progress,
         duration = EXCLUDED.duration,
         percentage = EXCLUDED.percentage,
         last_watched_at = CURRENT_TIMESTAMP`,
      [userId, videoId, validProgress, validDuration, percentage]
    );

    // Only log success occasionally
    if (now - lastLog > 30000) {
      console.log('✅ Progress updated successfully');
    }
    
    res.json({ success: true, message: 'Progress updated' });

  } catch (error) {
    console.error('❌ Progress update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get watch progress
app.get('/api/progress/:userId/:videoId', async (req, res) => {
  const { userId, videoId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM watch_progress WHERE user_id = $1 AND video_id = $2',
      [userId, videoId]
    );
    
    res.json({
      success: true,
      progress: result.rows[0] || null
    });

  } catch (error) {
    console.error('❌ Progress fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await pool.query('SELECT NOW()');
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      server: 'AnimeStream Video Server',
      version: '5.0.0',
      port: PORT,
      database: {
        type: 'PostgreSQL',
        status: 'connected',
        timestamp: dbResult.rows[0].now
      },
      ffmpeg: {
        path: process.env.FFMPEG_PATH || 'system',
        status: 'configured'
      },
      storage: {
        baseDir: BASE_DIR,
        segmentsDir: SEGMENTS_DIR,
        uploadDir: UPLOAD_DIR
      },
      urlStructure: {
        format: 'ID-based URLs',
        example: '/series/{seriesId}/episode/{episodeNumber}'
      },
      features: ['Video Upload', 'FFmpeg HLS Segmentation', 'HLS.js Compatible', 'PostgreSQL Storage', 'Watch Progress', 'Rate Limiting', 'Database Management', 'ID-Based URL Structure']
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large. Maximum size is 10GB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({ 
      success: false,
      error: `Upload error: ${error.message}`,
      code: error.code
    });
  }
  
  res.status(500).json({ 
    success: false,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: 'AnimeStream Video Server - PostgreSQL + FFmpeg HLS + ID-Based URL Structure',
    requestedUrl: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AnimeStream Video Server running on http://localhost:${PORT}`);
  console.log(`📁 Base Directory: ${BASE_DIR}`);
  console.log(`📁 Upload Directory: ${UPLOAD_DIR}`);
  console.log(`📁 Segments Directory: ${SEGMENTS_DIR}`);
  console.log(`🐘 Database: PostgreSQL (${process.env.DB_NAME})`);
  console.log(`🎬 FFmpeg: ${process.env.FFMPEG_PATH || 'system path'}`);
  console.log(`🌐 CORS enabled for: http://localhost:5173`);
  console.log(`🛡️  Rate limiting enabled`);
  console.log(`📡 HLS streaming ready with HLS.js support!`);
  console.log(`\n🎯 HLS URLs: http://localhost:${PORT}/segments/{series-slug}/tap-{episode}/playlist.m3u8`);
  console.log(`🎬 Browser compatibility: H.264 Baseline + AAC + HLS.js`);
  console.log(`📁 Path mapping: series-slug/tap-XX format for better organization`);
  console.log(`💾 Database management: Series, Episodes, Videos, Progress tracking`);
  console.log(`🔗 FIXED: ID-based URL structure for better stability`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await pool.end();
  console.log('✅ Database connections closed');
  process.exit(0);
});