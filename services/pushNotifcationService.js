const { Expo } = require('expo-server-sdk');
const { supabase } = require('../supabaseClient');

// Initialize Expo SDK
const expo = new Expo();

/**
 * Send a push notification to a specific user
 * @param {string} userId - The ID of the user to send the notification to
 * @param {Object} notification - The notification object
 * @param {string} notification.title - The title of the notification
 * @param {string} notification.body - The body of the notification
 * @param {Object} [notification.data] - Additional data to send with the notification
 * @param {string} [notification.type='general'] - The type of notification
 * @returns {Promise<Object>} - The result of sending the notification
 */
async function sendPushNotification(userId, notification) {
  try {
    // Get user's push token and notification preferences
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      return { success: false, error: 'Push token not found' };
    }

    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefError || !preferences) {
      return { success: false, error: 'Notification preferences not found' };
    }

    // Check if notifications are enabled
    if (!preferences.enabled) {
      return { success: false, error: 'Notifications are disabled for this user' };
    }

    // Check if this type of notification is enabled
    const notificationType = notification.type || 'general';
    if (!preferences[`${notificationType}_notifications`]) {
      return { success: false, error: `${notificationType} notifications are disabled` };
    }

    // Create the message
    const message = {
      to: tokenData.token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        type: notificationType,
        timestamp: new Date().toISOString(),
      },
    };

    // Send the notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
      }
    }

    // Store the notification in the database
    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notificationType,
        title: notification.title,
        message: notification.body,
        data: notification.data || {},
        read: false,
      });

    if (dbError) {
      console.error('Error storing notification:', dbError);
    }

    return { success: true, tickets };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple users
 * @param {string[]} userIds - Array of user IDs to send notifications to
 * @param {Object} notification - The notification object
 * @returns {Promise<Object>} - The result of sending the notifications
 */
async function sendBulkPushNotifications(userIds, notification) {
  try {
    const results = [];
    for (const userId of userIds) {
      const result = await sendPushNotification(userId, notification);
      results.push({ userId, ...result });
    }
    return { success: true, results };
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a notification to all users who follow a specific user
 * @param {string} followedUserId - The ID of the user who was followed
 * @param {Object} notification - The notification object
 * @returns {Promise<Object>} - The result of sending the notifications
 */
async function sendFollowerNotification(followedUserId, notification) {
  try {
    // Get all followers of the user
    const { data: followers, error: followersError } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('following_id', followedUserId);

    if (followersError) {
      return { success: false, error: 'Error fetching followers' };
    }

    const followerIds = followers.map(f => f.follower_id);
    return await sendBulkPushNotifications(followerIds, notification);
  } catch (error) {
    console.error('Error sending follower notifications:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendFollowerNotification,
}; 