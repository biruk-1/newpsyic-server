// server/services/notificationService.js

const { Expo } = require('expo-server-sdk');
const { supabase } = require('../supabaseClient');

// Initialize Expo with access token
const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// Validate push token
function isValidPushToken(token) {
  return Expo.isExpoPushToken(token);
}

// Handle notification receipts
async function handleNotificationReceipts(receipts) {
  const receiptIds = receipts.map(receipt => receipt.id);
  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  const receiptChunks = [];

  for (let chunk of receiptIdChunks) {
    try {
      const receiptChunk = await expo.getPushNotificationReceiptsAsync(chunk);
      receiptChunks.push(receiptChunk);
    } catch (error) {
      console.error('Error getting push notification receipts:', error);
    }
  }

  return receiptChunks;
}

async function sendPushNotification(userId, notification) {
  try {
    // Get user's push token and notification preferences
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (tokenError) {
      return { success: false, error: 'Push token not found' };
    }

    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefError) {
      return { success: false, error: 'Notification preferences not found' };
    }

    if (!tokenData?.token) {
      return { success: false, error: 'Push token not found' };
    }

    if (!isValidPushToken(tokenData.token)) {
      // Remove invalid token
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', tokenData.token);

      return { success: false, error: 'Invalid push token' };
    }

    if (!preferences?.enabled) {
      return { success: false, error: 'Push notifications not enabled' };
    }

    // Check if this type of notification is enabled
    if (!preferences[notification.type]) {
      return { success: false, error: 'Notification type disabled' };
    }

    // Construct the message
    const message = {
      to: tokenData.token,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        type: notification.type,
        timestamp: new Date().toISOString(),
      },
      priority: notification.priority || 'high',
      channelId: notification.channelId || 'default',
    };

    // Store the notification in the database
    const { data: notificationData, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.body,
        data: notification.data || {},
        read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error storing notification:', notificationError);
      return { success: false, error: 'Failed to store notification' };
    }

    // Send the notification
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

    // Store the ticket IDs with the notification
    const ticketIds = tickets.map(ticket => ticket.id);
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        ticket_ids: ticketIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationData.id);

    if (updateError) {
      console.error('Error updating notification with ticket IDs:', updateError);
    }

    return {
      success: true,
      tickets,
      notificationId: notificationData.id,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

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

// Send notification to all followers of a user
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

    if (!followers.length) {
      return { success: false, error: 'No followers found' };
    }

    const followerIds = followers.map(f => f.follower_id);
    return await sendBulkPushNotifications(followerIds, {
      ...notification,
      type: 'following'
    });
  } catch (error) {
    console.error('Error sending follower notifications:', error);
    return { success: false, error: error.message };
  }
}

// Check notification delivery status
async function checkNotificationStatus(notificationId) {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('ticket_ids')
      .eq('id', notificationId)
      .single();

    if (error || !notification?.ticket_ids) {
      return { success: false, error: 'Notification not found' };
    }

    const receipts = await handleNotificationReceipts(
      notification.ticket_ids.map(id => ({ id }))
    );

    return { success: true, receipts };
  } catch (error) {
    console.error('Error checking notification status:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendFollowerNotification,
  checkNotificationStatus,
  handleNotificationReceipts,
};