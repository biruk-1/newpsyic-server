const express = require('express');
const router = express.Router();
const { 
  sendPushNotification, 
  sendBulkPushNotifications, 
  sendFollowerNotification 
} = require('../services/pushNotificationService');
const { supabase } = require('../supabaseClient');

// Middleware to check if user is authenticated
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Add the user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Send notification to a specific user
router.post('/send', authenticateUser, async (req, res) => {
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

    res.json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send notification to multiple users
router.post('/send-bulk', authenticateUser, async (req, res) => {
  try {
    const { userIds, title, body, data, type } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendBulkPushNotifications(userIds, {
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
      message: 'Notifications sent successfully',
      results: result.results 
    });
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Send notification to all followers of a user
router.post('/send-to-followers', authenticateUser, async (req, res) => {
  try {
    const { followedUserId, title, body, data, type } = req.body;

    if (!followedUserId || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendFollowerNotification(followedUserId, {
      title,
      body,
      data,
      type: type || 'following'
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

module.exports = router; 