const express = require('express');
const { z } = require('zod');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const profileSchema = z.object({
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  birthLocation: z.string(),
  interests: z.array(z.string()),
});

router.post('/profile', authenticateToken, (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    
    db.prepare(`
      UPDATE users
      SET birth_date = ?,
          birth_time = ?,
          birth_location = ?,
          interests = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.birthDate,
      data.birthTime,
      data.birthLocation,
      JSON.stringify(data.interests),
      req.user.id
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;