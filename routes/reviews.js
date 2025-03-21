const express = require('express');
const { z } = require('zod');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).optional()
});

// Create a review
router.post('/:psychicId', authenticateToken, (req, res, next) => {
  try {
    const data = reviewSchema.parse(req.body);
    const reviewId = crypto.randomUUID();

    // Check if user has a completed booking with this psychic
    const hasBooking = db.prepare(`
      SELECT 1 FROM bookings
      WHERE user_id = ? AND psychic_id = ? AND status = 'completed'
      LIMIT 1
    `).get(req.user.id, req.params.psychicId);

    if (!hasBooking) {
      return res.status(403).json({ error: 'You must complete a session before leaving a review' });
    }

    // Check if user already reviewed this psychic
    const existingReview = db.prepare(`
      SELECT 1 FROM reviews
      WHERE user_id = ? AND psychic_id = ?
      LIMIT 1
    `).get(req.user.id, req.params.psychicId);

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this psychic' });
    }

    db.prepare(`
      INSERT INTO reviews (id, psychic_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(reviewId, req.params.psychicId, req.user.id, data.rating, data.comment);

    // Update psychic's average rating
    db.prepare(`
      UPDATE psychics
      SET rating = (
        SELECT AVG(rating)
        FROM reviews
        WHERE psychic_id = ?
      ),
      total_reviews = total_reviews + 1
      WHERE id = ?
    `).run(req.params.psychicId, req.params.psychicId);

    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (err) {
    next(err);
  }
});

// Get reviews for a psychic
router.get('/:psychicId', (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.full_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.psychic_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.psychicId);

  res.json(reviews);
});

module.exports = router;