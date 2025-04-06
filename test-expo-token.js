const { Expo } = require('expo-server-sdk');
require('dotenv').config();

async function testExpoToken() {
  try {
    const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
    console.log('Expo SDK initialized successfully');
    console.log('Access Token:', process.env.EXPO_ACCESS_TOKEN ? 'Present' : 'Missing');
    
    // Try to send a test notification to verify the token
    const message = {
      to: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', // Replace with a real token for testing
      sound: 'default',
      title: 'Test Notification',
      body: 'This is a test notification',
    };

    const chunks = expo.chunkPushNotifications([message]);
    console.log('Token validation successful');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Project ID:', process.env.EXPO_PROJECT_ID);
  } catch (error) {
    console.error('Error testing Expo token:', error);
  }
}

testExpoToken(); 