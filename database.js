const Database = require('better-sqlite3');
const path = require('path');
const { logger } = require('./utils/logger');

const db = new Database(path.join(__dirname, 'psychic_directory.db'), {
  verbose: (message) => logger.debug(message)
});

// Function to check if a column exists in a table
function columnExists(tableName, columnName) {
  const query = `PRAGMA table_info(${tableName})`;
  const columns = db.prepare(query).all();
  return columns.some(col => col.name === columnName);
}

function setupDatabase() {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      role TEXT CHECK(role IN ('user', 'psychic', 'admin')) DEFAULT 'user'
    )
  `);

  // Create psychics table with profile_image column
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

  logger.info('Database setup completed');
}

module.exports = {
  db,
  setupDatabase
};
