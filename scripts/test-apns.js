require('dotenv').config();
const { sendIOSPushNotification } = require('../services/apnsService');

// Check if environment variables are set
const requiredEnvVars = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_BUNDLE_ID'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Error: Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`- ${varName}`));
  console.error('\nPlease add these variables to your .env file.');
  process.exit(1);
}

// Check if the APNs key file exists
const fs = require('fs');
const path = require('path');
const keyPath = path.join(__dirname, '../certs/AuthKey.p8');

if (!fs.existsSync(keyPath)) {
  console.error('Error: APNs key file not found.');
  console.error(`Expected path: ${keyPath}`);
  console.error('\nPlease run the setup-apns.js script first.');
  process.exit(1);
}

// Get device token from command line arguments
const deviceToken = process.argv[2];

if (!deviceToken) {
  console.error('Error: Device token not provided.');
  console.error('Usage: node test-apns.js <device_token>');
  process.exit(1);
}

// Send a test notification
async function testAPNs() {
  console.log('Testing APNs setup...');
  console.log(`Key ID: ${process.env.APNS_KEY_ID}`);
  console.log(`Team ID: ${process.env.APNS_TEAM_ID}`);
  console.log(`Bundle ID: ${process.env.APNS_BUNDLE_ID}`);
  console.log(`Device Token: ${deviceToken}`);
  console.log('');

  try {
    const result = await sendIOSPushNotification(deviceToken, {
      title: 'APNs Test',
      body: 'This is a test notification from your server.',
      type: 'test',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ APNs test successful! Your server is correctly configured for iOS push notifications.');
    } else {
      console.log('\n❌ APNs test failed. Check the error message above.');
      
      if (result.code === 'DEVICE_NOT_REGISTERED') {
        console.log('\nThis device token is no longer valid. The user may have uninstalled the app or disabled notifications.');
      } else if (result.code === 'INVALID_TOKEN') {
        console.log('\nThe device token format is invalid. Make sure you\'re using a valid iOS device token.');
      } else if (result.code === 'INVALID_BUNDLE_ID') {
        console.log('\nThe bundle ID is invalid. Make sure it matches your app\'s bundle ID in the Apple Developer portal.');
      }
    }
  } catch (error) {
    console.error('Error testing APNs:', error);
  }
}

testAPNs(); 