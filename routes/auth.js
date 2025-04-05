const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { db } = require('../database');
const { logger } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(5),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(['user', 'psychic']).default('user')
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, data.email, passwordHash, data.fullName, data.phone, data.role);

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    logger.info(`Login attempt for email: ${data.email}`);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
    if (!user) {
      logger.warn(`Login failed: User not found for email ${data.email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) {
      logger.warn(`Login failed: Invalid password for email ${data.email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    logger.info(`Login successful for user: ${user.id}`);

    res.json({ token });
  } catch (err) {
    logger.error('Login error:', err);
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: err.errors });
    }
    next(err);
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json(user);
});

module.exports = router;