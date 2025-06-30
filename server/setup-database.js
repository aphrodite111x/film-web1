import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const setupDatabase = async () => {
  console.log('🔧 Setting up PostgreSQL database...');
  
  // First connect to postgres database to create our database
  const adminClient = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL');

    // Create database if it doesn't exist
    try {
      await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`✅ Database '${process.env.DB_NAME}' created`);
    } catch (error) {
      if (error.code === '42P04') {
        console.log(`ℹ️  Database '${process.env.DB_NAME}' already exists`);
      } else {
        throw error;
      }
    }

    await adminClient.end();

    // Now connect to our database and create tables
    const client = new Client({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await client.connect();
    console.log(`✅ Connected to database '${process.env.DB_NAME}'`);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT,
        is_vip BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        vip_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create series table
    await client.query(`
      CREATE TABLE IF NOT EXISTS series (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        title_vietnamese VARCHAR(255) NOT NULL,
        description TEXT,
        year INTEGER NOT NULL,
        rating REAL DEFAULT 0,
        genre TEXT[] DEFAULT '{}',
        director VARCHAR(255),
        studio VARCHAR(255),
        thumbnail TEXT,
        banner TEXT,
        trailer TEXT,
        featured BOOLEAN DEFAULT false,
        new BOOLEAN DEFAULT false,
        popular BOOLEAN DEFAULT false,
        episode_count INTEGER DEFAULT 0,
        total_duration VARCHAR(50),
        status VARCHAR(20) DEFAULT 'ongoing',
        air_day VARCHAR(20),
        air_time VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Series table created');

    // Create episodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        title_vietnamese VARCHAR(255) NOT NULL,
        description TEXT,
        duration VARCHAR(20),
        thumbnail TEXT,
        release_date DATE,
        rating REAL DEFAULT 0,
        watched BOOLEAN DEFAULT false,
        watch_progress REAL DEFAULT 0,
        last_watched_at TIMESTAMP,
        guest_cast TEXT[],
        director_notes TEXT,
        has_behind_scenes BOOLEAN DEFAULT false,
        has_commentary BOOLEAN DEFAULT false,
        source_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(series_id, number)
      )
    `);
    console.log('✅ Episodes table created');

    // Create videos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        episode_number INTEGER NOT NULL,
        original_filename TEXT NOT NULL,
        safe_filename TEXT NOT NULL,
        duration REAL NOT NULL DEFAULT 0,
        file_size BIGINT NOT NULL DEFAULT 0,
        video_path TEXT NOT NULL,
        hls_manifest_path TEXT,
        hls_manifest_path_4k TEXT,
        thumbnail_path TEXT,
        status VARCHAR(20) DEFAULT 'uploading',
        processing_progress INTEGER DEFAULT 0,
        total_segments INTEGER DEFAULT 0,
        total_segments_4k INTEGER DEFAULT 0,
        series_title VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(series_id, episode_number)
      )
    `);
    console.log('✅ Videos table created with 4K support');

    // Create segments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        segment_number INTEGER NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        duration REAL NOT NULL,
        file_size BIGINT NOT NULL,
        quality VARCHAR(10) DEFAULT '1080p',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id, segment_number, quality)
      )
    `);
    console.log('✅ Segments table created with quality support');

    // Create watch progress table
    await client.query(`
      CREATE TABLE IF NOT EXISTS watch_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        progress REAL NOT NULL,
        duration REAL NOT NULL,
        percentage REAL NOT NULL,
        last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, video_id)
      )
    `);
    console.log('✅ Watch progress table created');

    // Create favorites table
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, series_id)
      )
    `);
    console.log('✅ Favorites table created');

    // Create ratings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, series_id, episode_id)
      )
    `);
    console.log('✅ Ratings table created');

    // Create comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        likes INTEGER DEFAULT 0,
        parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Comments table created');

    // Create VIP transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vip_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        transaction_code VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);
    console.log('✅ VIP transactions table created');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_series_featured ON series(featured);
      CREATE INDEX IF NOT EXISTS idx_series_new ON series(new);
      CREATE INDEX IF NOT EXISTS idx_series_popular ON series(popular);
      CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_number ON episodes(series_id, number);
      CREATE INDEX IF NOT EXISTS idx_videos_series_episode ON videos(series_id, episode_number);
      CREATE INDEX IF NOT EXISTS idx_videos_series_title ON videos(series_title);
      CREATE INDEX IF NOT EXISTS idx_segments_video_id ON segments(video_id);
      CREATE INDEX IF NOT EXISTS idx_watch_progress_user_video ON watch_progress(user_id, video_id);
      CREATE INDEX IF NOT EXISTS idx_favorites_user_series ON favorites(user_id, series_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_user_series ON ratings(user_id, series_id);
      CREATE INDEX IF NOT EXISTS idx_comments_series ON comments(series_id);
      CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(episode_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
    `);
    console.log('✅ Database indexes created');

    // Insert default admin user
    await client.query(`
      INSERT INTO users (email, username, password_hash, is_admin, is_vip)
      VALUES ('admin@animestream.com', 'Admin', '$2b$10$dummy.hash.for.demo', true, true)
      ON CONFLICT (email) DO NOTHING
    `);
    console.log('✅ Default admin user created');

    await client.end();
    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup error:', error);
    process.exit(1);
  }
};

setupDatabase();