# iOS Push Notifications Setup (APNs)

This guide will help you set up Apple Push Notification service (APNs) for your iOS app.

## Prerequisites

1. Apple Developer Account ($99/year)
2. APNs key (.p8 file) from Apple Developer Portal
3. Your app's bundle ID

## Setup Steps

### 1. Get APNs Key from Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to "Certificates, Identifiers & Profiles" > "Keys"
3. Click the "+" button to create a new key
4. Name it "Cosmic AI push key" (or any name you prefer)
5. Check "Apple Push Notifications service (APNs)"
6. Click "Continue" and then "Register"
7. Download the .p8 file (you can only download it once!)
8. Note down the Key ID (e.g., 3J733VT4RV)
9. Note down your Team ID (e.g., P4R37P8JLK)

### 2. Set Up Environment Variables

Add these variables to your `.env` file:

```
APNS_KEY_ID=3J733VT4RV
APNS_TEAM_ID=P4R37P8JLK
APNS_BUNDLE_ID=com.biruk123.boltexponativewind
```

### 3. Place the APNs Key File

Run the setup script:

```bash
node server/scripts/setup-apns.js
```

When prompted, enter the path to your downloaded .p8 file.

### 4. Test Your APNs Setup

To test your APNs setup, you need a valid iOS device token. You can get this from your app by:

1. Building and installing your app on a physical iOS device
2. Running the app and registering for push notifications
3. Getting the device token from the console logs

Then run the test script:

```bash
node server/scripts/test-apns.js <device_token>
```

## Troubleshooting

### Common Issues

1. **"Invalid device token" error**
   - Make sure you're using a valid iOS device token
   - The token should be 64 characters long and contain only hexadecimal characters

2. **"Device not registered" error**
   - The device token is no longer valid
   - The user may have uninstalled the app or disabled notifications

3. **"Bad topic" error**
   - The bundle ID doesn't match your app's bundle ID in the Apple Developer portal
   - Make sure the `APNS_BUNDLE_ID` environment variable is correct

4. **"Authentication error" error**
   - Your APNs key is invalid or expired
   - Make sure you've downloaded the correct .p8 file
   - Check that your Key ID and Team ID are correct

### Debugging Tips

1. Check the server logs for detailed error messages
2. Verify that your environment variables are set correctly
3. Make sure the .p8 file is in the correct location
4. Test with a known good device token

## Frontend Implementation

In your React Native app, you need to:

1. Request notification permissions
2. Get the device token
3. Send the token to your server

Example code:

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'ios') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
  }

  if (Device.isDevice) {
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '97463d6c-3913-4eb9-9d68-92f40580d83d'
    })).data;
  } else {
    alert('Must use physical device for Push Notifications');
    return;
  }

  // Send the token to your server
  await fetch('YOUR_API_URL/api/notifications/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      deviceType: Platform.OS // This will be 'ios' for iOS devices
    }),
  });

  return token;
}
```

## Additional Resources

- [Apple Push Notification Service Documentation](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [APN Node.js Package Documentation](https://github.com/node-apn/node-apn) 