const Database = require('better-sqlite3');
const path = require('path');
const { logger } = require('./utils/logger');

// Ensure the database directory exists
const dbPath = path.join(__dirname, 'psychic_directory.db');
logger.info(`Initializing database at: ${dbPath}`);

let db;
try {
  db = new Database(dbPath, {
    verbose: (message) => logger.debug(message)
  });
  logger.info('Database connection established successfully');
} catch (error) {
  logger.error('Failed to initialize database:', error);
  throw error;
}

// Function to check if a column exists in a table
function columnExists(tableName, columnName) {
  try {
    const query = `PRAGMA table_info(${tableName})`;
    const columns = db.prepare(query).all();
    return columns.some(col => col.name === columnName);
  } catch (error) {
    logger.error(`Error checking column existence: ${error.message}`);
    return false;
  }
}

function setupDatabase() {
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    logger.info('Foreign keys enabled');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        birth_date TEXT,
        birth_time TEXT,
        birth_location TEXT,
        interests TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        role TEXT CHECK(role IN ('user', 'psychic', 'admin')) DEFAULT 'user'
      )
    `);
    logger.info('Users table created or verified');

    // Create push_tokens table
    db.exec(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        device_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create notification_preferences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id TEXT PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        daily_horoscope BOOLEAN DEFAULT true,
        psychic_updates BOOLEAN DEFAULT true,
        moon_phases BOOLEAN DEFAULT true,
        planetary_transits BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create notifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        read BOOLEAN DEFAULT false,
        ticket_ids TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create followers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS followers (
        id TEXT PRIMARY KEY,
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(follower_id, following_id)
      )
    `);

    // Create psychics table
    db.exec(`
      CREATE TABLE IF NOT EXISTS psychics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        bio TEXT,
        specialties TEXT,
        experience_years INTEGER,
        hourly_rate DECIMAL(10,2),
        rating DECIMAL(3,2),
        total_reviews INTEGER DEFAULT 0,
        is_verified BOOLEAN DEFAULT 0,
        availability_status TEXT DEFAULT 'offline',
        profile_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create reviews table
    db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        psychic_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        rating INTEGER CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (psychic_id) REFERENCES psychics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create bookings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        psychic_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
        scheduled_time DATETIME NOT NULL,
        duration_minutes INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (psychic_id) REFERENCES psychics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Update users table to include onboarding fields (with checks for existing columns)
    if (!columnExists('users', 'birth_date')) {
      db.exec(`ALTER TABLE users ADD COLUMN birth_date TEXT`);
    }
    if (!columnExists('users', 'birth_time')) {
      db.exec(`ALTER TABLE users ADD COLUMN birth_time TEXT`);
    }
    if (!columnExists('users', 'birth_location')) {
      db.exec(`ALTER TABLE users ADD COLUMN birth_location TEXT`);
    }
    if (!columnExists('users', 'interests')) {
      db.exec(`ALTER TABLE users ADD COLUMN interests TEXT`);
    }

    // Add profile_image column to psychics table (if not exists)
    if (!columnExists('psychics', 'profile_image')) {
      db.exec(`ALTER TABLE psychics ADD COLUMN profile_image TEXT`);
    }

    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Error setting up database:', error);
    throw error;
  }
}

module.exports = {
  db,
  setupDatabase
};
