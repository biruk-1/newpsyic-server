const { Expo } = require('expo-server-sdk');
const { supabase } = require('../supabaseClient');
const { sendIOSPushNotification, isValidIOSDeviceToken } = require('./apnsService');

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

// Send daily horoscope notification
async function sendDailyHoroscopeNotification(userId, horoscopeData) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('birth_date, notification_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.notification_preferences?.dailyHoroscope) {
      return { success: false, error: 'Daily horoscope notifications disabled' };
    }

    return await sendPushNotification(userId, {
      type: 'dailyHoroscope',
      title: 'Your Daily Horoscope',
      body: horoscopeData.prediction,
      data: {
        sign: horoscopeData.sign,
        date: horoscopeData.date
      }
    });
  } catch (error) {
    console.error('Error sending daily horoscope:', error);
    return { success: false, error: error.message };
  }
}

// Send psychic update notification
async function sendPsychicUpdateNotification(psychicId, updateContent) {
  try {
    const { data: followers, error: followersError } = await supabase
      .from('followers')
      .select('follower_id')
      .eq('following_id', psychicId);

    if (followersError) {
      return { success: false, error: 'Error fetching followers' };
    }

    if (!followers.length) {
      return { success: false, error: 'No followers found' };
    }

    const followerIds = followers.map(f => f.follower_id);
    return await sendBulkPushNotifications(followerIds, {
      type: 'psychicUpdate',
      title: 'New Update from Your Psychic',
      body: updateContent.message,
      data: {
        psychicId,
        updateType: updateContent.type,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error sending psychic update:', error);
    return { success: false, error: error.message };
  }
}

async function sendPushNotification(userId, notification) {
  try {
    // Get user's push token and notification preferences
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token, device_type')
      .eq('user_id', userId)
      .single();

    if (tokenError) {
      console.log(`No push token found for user ${userId}`);
      return { success: false, error: 'Push token not found' };
    }

    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefError) {
      console.log(`No notification preferences found for user ${userId}`);
      return { success: false, error: 'Notification preferences not found' };
    }

    if (!tokenData?.token) {
      console.log(`Push token missing for user ${userId}`);
      return { success: false, error: 'Push token not found' };
    }

    // Check if this is an iOS device token
    if (tokenData.device_type === 'ios') {
      if (!isValidIOSDeviceToken(tokenData.token)) {
        await supabase
          .from('push_tokens')
          .delete()
          .eq('user_id', userId)
          .eq('token', tokenData.token);
        console.log(`Invalid iOS push token for user ${userId}: ${tokenData.token}`);
        return { success: false, error: 'Invalid iOS push token' };
      }

      // Send using APNs
      const result = await sendIOSPushNotification(tokenData.token, notification);
      
      if (!result.success) {
        if (result.code === 'DEVICE_NOT_REGISTERED') {
          await supabase
            .from('push_tokens')
            .delete()
            .eq('user_id', userId)
            .eq('token', tokenData.token);
          console.log(`Device not registered for user ${userId}, token removed`);
        } else if (result.code === 'KEY_FILE_MISSING') {
          console.error('APNs key file missing. iOS notifications are disabled.');
          return { 
            success: false, 
            error: 'APNs key file missing. iOS notifications are disabled.',
            code: 'KEY_FILE_MISSING'
          };
        }
        console.log(`Failed to send iOS notification to user ${userId}: ${result.error}`);
        return result;
      }
      
      // Store the notification in the database for iOS
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.body,
          data: JSON.stringify(notification.data || {}),
          read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (notificationError) {
        console.error('Error storing notification:', notificationError);
      } else {
        console.log(`iOS notification sent and stored for user ${userId}, notificationId: ${notificationData?.id}`);
      }

      return {
        success: true,
        message: 'iOS notification sent successfully',
        notificationId: notificationData?.id
      };
    }

    // For non-iOS devices, use Expo
    if (!Expo.isExpoPushToken(tokenData.token)) {
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', tokenData.token);
      console.log(`Invalid Expo push token for user ${userId}: ${tokenData.token}`);
      return { success: false, error: 'Invalid push token' };
    }

    if (!preferences?.enabled) {
      console.log(`Push notifications disabled for user ${userId}`);
      return { success: false, error: 'Push notifications not enabled' };
    }

    const notificationType = notification.type === 'dailyHoroscope' ? 'dailyHoroscope' : 'psychicUpdates';
    if (!preferences[notificationType]) {
      console.log(`Notification type ${notificationType} disabled for user ${userId}`);
      return { success: false, error: 'Notification type disabled' };
    }

    const message = {
      to: tokenData.token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        type: notification.type,
        timestamp: new Date().toISOString(),
      },
      priority: 'high',
      channelId: 'default',
      android: {
        sound: true,
        vibrate: true,
        channelId: 'default',
        priority: 'high'
      }
    };

    const { data: notificationData, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.body,
        data: JSON.stringify(notification.data || {}),
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

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        console.log(`Expo notification sent to user ${userId}, tickets:`, ticketChunk);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }

    return {
      success: true,
      message: 'Notification sent successfully',
      notificationId: notificationData.id,
      tickets
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
    console.log('Bulk notifications sent:', results);
    return { success: true, results };
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
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
      console.log(`Notification ${notificationId} not found`);
      return { success: false, error: 'Notification not found' };
    }

    const ticketIds = JSON.parse(notification.ticket_ids);
    const receipts = await handleNotificationReceipts(
      ticketIds.map(id => ({ id }))
    );
    console.log(`Notification status checked for ${notificationId}:`, receipts);

    return { success: true, receipts };
  } catch (error) {
    console.error('Error checking notification status:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendDailyHoroscopeNotification,
  sendPsychicUpdateNotification,
  checkNotificationStatus,
  handleNotificationReceipts,
};