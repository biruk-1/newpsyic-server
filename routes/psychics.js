const express = require('express');
const { z } = require('zod');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all psychics with optional filters
router.get('/', (req, res) => {
  const { specialty, rating, verified } = req.query;

  let query = `
    SELECT p.*, u.full_name, u.email
    FROM psychics p
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (specialty) {
    query += ' AND p.specialties LIKE ?';
    params.push(`%${specialty}%`);
  }

  if (rating) {
    query += ' AND p.rating >= ?';
    params.push(rating);
  }

  if (verified) {
    query += ' AND p.is_verified = ?';
    params.push(verified === 'true' ? 1 : 0);
  }

  const psychics = db.prepare(query).all(...params);
  res.json(psychics);
});

// Get a specific psychic
router.get('/:id', (req, res) => {
  const psychic = db.prepare(`
    SELECT p.*, u.full_name, u.email
    FROM psychics p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!psychic) {
    return res.status(404).json({ error: 'Psychic not found' });
  }

  res.json(psychic);
});

const psychicProfileSchema = z.object({
  bio: z.string().min(10),
  specialties: z.string(),
  experienceYears: z.number().int().min(0),
  hourlyRate: z.number().positive()
});

// Create or update psychic profile
router.post('/profile', authenticateToken, requireRole('psychic'), (req, res, next) => {
  try {
    const data = psychicProfileSchema.parse(req.body);
    const psychicId = crypto.randomUUID();

    const existing = db.prepare('SELECT id FROM psychics WHERE user_id = ?').get(req.user.id);

    if (existing) {
      db.prepare(`
        UPDATE psychics
        SET bio = ?, specialties = ?, experience_years = ?, hourly_rate = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(data.bio, data.specialties, data.experienceYears, data.hourlyRate, req.user.id);

      res.json({ message: 'Profile updated successfully' });
    } else {
      db.prepare(`
        INSERT INTO psychics (id, user_id, bio, specialties, experience_years, hourly_rate)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(psychicId, req.user.id, data.bio, data.specialties, data.experienceYears, data.hourlyRate);

      res.status(201).json({ message: 'Profile created successfully' });
    }
  } catch (err) {
    next(err);
  }
});

// Get psychic availability
router.get('/:id/availability', (req, res) => {
  const availability = db.prepare(`
    SELECT scheduled_time, duration_minutes
    FROM bookings
    WHERE psychic_id = ? AND status != 'cancelled'
    AND scheduled_time >= DATE('now')
    ORDER BY scheduled_time ASC
  `).all(req.params.id);

  res.json(availability);
});

module.exports = router;