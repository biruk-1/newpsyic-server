const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const { authenticateToken } = require('../middleware/auth');
const { db } = require('../database');
const { 
  sendPushNotification, 
  sendBulkPushNotifications, 
  sendFollowerNotification,
  checkNotificationStatus 
} = require('../services/notificationService');

// Initialize Expo client
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// Get user's notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = await db.get(
      'SELECT * FROM notification_preferences WHERE user_id = ?',
      [req.user.id]
    );
    res.json(preferences || {
      enabled: true,
      messages: true,
      following: true,
      readings: true,
      promotions: false,
      dailyHoroscope: true,
      moonPhases: true,
      planetaryTransits: true,
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update user's notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = req.body;
    await db.run(
      `INSERT OR REPLACE INTO notification_preferences 
       (user_id, enabled, messages, following, readings, promotions, dailyHoroscope, moonPhases, planetaryTransits)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        preferences.enabled,
        preferences.messages,
        preferences.following,
        preferences.readings,
        preferences.promotions,
        preferences.dailyHoroscope,
        preferences.moonPhases,
        preferences.planetaryTransits,
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Store push token
router.post('/token', authenticateToken, async (req, res) => {
  try {
    const { token, deviceType } = req.body;
    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    await db.run(
      `INSERT OR REPLACE INTO push_tokens 
       (user_id, token, device_type, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [req.user.id, token, deviceType || 'unknown']
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing push token:', error);
    res.status(500).json({ error: 'Failed to store push token' });
  }
});

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const notifications = await db.all(query, params);
    res.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Send a notification
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { userId, title, body, data, type } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendPushNotification(userId, {
      title,
      body,
      data,
      type: type || 'general'
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'Notification sent successfully',
      notificationId: result.notificationId
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send notification to followers
router.post('/send-to-followers', authenticateToken, async (req, res) => {
  try {
    const { followedUserId, title, body, data } = req.body;

    if (!followedUserId || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendFollowerNotification(followedUserId, {
      title,
      body,
      data
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'Notifications sent to followers successfully',
      results: result.results
    });
  } catch (error) {
    console.error('Error sending follower notifications:', error);
    res.status(500).json({ error: 'Failed to send follower notifications' });
  }
});

// Check notification status
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const result = await checkNotificationStatus(req.params.id);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error checking notification status:', error);
    res.status(500).json({ error: 'Failed to check notification status' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.run(
      'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.run(
      'UPDATE notifications SET read = 1 WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Test push notification endpoint
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    if (!Expo.isExpoPushToken(token)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    const message = {
      to: token,
      sound: process.env.EXPO_PUSH_NOTIFICATION_SOUND || 'default',
      title: 'Test Notification',
      body: 'This is a test notification from your server',
      data: { type: 'test' },
      priority: process.env.EXPO_PUSH_NOTIFICATION_PRIORITY || 'high',
      channelId: process.env.EXPO_PUSH_NOTIFICATION_CHANNEL_ID || 'default',
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
      }
    }

    res.json({ 
      success: true, 
      message: 'Test notification sent successfully',
      tickets 
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router; 