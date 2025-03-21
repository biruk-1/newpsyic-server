const express = require('express');
const { z } = require('zod');
const { db } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const bookingSchema = z.object({
  scheduledTime: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(120)
});

// Create a booking
router.post('/:psychicId', authenticateToken, (req, res, next) => {
  try {
    const data = bookingSchema.parse(req.body);
    const bookingId = crypto.randomUUID();

    // Get psychic's hourly rate
    const psychic = db.prepare('SELECT hourly_rate FROM psychics WHERE id = ?').get(req.params.psychicId);
    if (!psychic) {
      return res.status(404).json({ error: 'Psychic not found' });
    }

    // Calculate total amount
    const totalAmount = (psychic.hourly_rate / 60) * data.durationMinutes;

    db.prepare(`
      INSERT INTO bookings (
        id, psychic_id, user_id, scheduled_time, 
        duration_minutes, total_amount
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      bookingId,
      req.params.psychicId,
      req.user.id,
      data.scheduledTime,
      data.durationMinutes,
      totalAmount
    );

    res.status(201).json({
      message: 'Booking created successfully',
      bookingId,
      totalAmount
    });
  } catch (err) {
    next(err);
  }
});

// Get user's bookings
router.get('/my-bookings', authenticateToken, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, p.*, u.full_name as psychic_name
    FROM bookings b
    JOIN psychics p ON b.psychic_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.scheduled_time DESC
  `).all(req.user.id);

  res.json(bookings);
});

// Get psychic's bookings
router.get('/my-schedule', authenticateToken, requireRole('psychic'), (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, u.full_name as client_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN psychics p ON b.psychic_id = p.id
    WHERE p.user_id = ?
    ORDER BY b.scheduled_time DESC
  `).all(req.user.id);

  res.json(bookings);
});

// Update booking status
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  
  if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  // Only allow psychic or the client to update the booking
  const psychic = db.prepare('SELECT user_id FROM psychics WHERE id = ?').get(booking.psychic_id);
  
  if (req.user.id !== booking.user_id && req.user.id !== psychic.user_id) {
    return res.status(403).json({ error: 'Not authorized to update this booking' });
  }

  db.prepare(`
    UPDATE bookings
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, req.params.id);

  res.json({ message: 'Booking status updated successfully' });
});

module.exports = router;