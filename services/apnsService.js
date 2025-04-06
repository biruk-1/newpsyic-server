const apn = require('apn');
const path = require('path');

// Initialize APNs provider
const apnProvider = new apn.Provider({
    token: {
        key: path.join(__dirname, '../certs/AuthKey.p8'), // Path to your .p8 file
        keyId: process.env.APNS_KEY_ID, // Your Key ID from Apple Developer account
        teamId: process.env.APNS_TEAM_ID, // Your Team ID from Apple Developer account
    },
    production: process.env.NODE_ENV === 'production', // Set to false for development
    bundleId: process.env.APNS_BUNDLE_ID // Your app's bundle ID
});

// Send iOS push notification
async function sendIOSPushNotification(deviceToken, notification) {
    try {
        const note = new apn.Notification();
        
        // Set notification properties
        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now
        note.badge = 1;
        note.sound = "default";
        note.alert = {
            title: notification.title,
            body: notification.body
        };
        
        // Add custom data
        note.payload = {
            ...notification.data,
            type: notification.type,
            timestamp: new Date().toISOString()
        };

        // Set topic (bundle ID)
        note.topic = process.env.APNS_BUNDLE_ID;

        // Send the notification
        const result = await apnProvider.send(note, deviceToken);
        
        if (result.failed.length > 0) {
            console.error('APNs Error:', result.failed[0].response);
            
            // Handle specific error cases
            const error = result.failed[0].response;
            if (error.reason === 'Unregistered') {
                // Device token is no longer valid
                return {
                    success: false,
                    error: 'Device token is no longer valid',
                    code: 'DEVICE_NOT_REGISTERED'
                };
            } else if (error.reason === 'BadDeviceToken') {
                // Invalid device token format
                return {
                    success: false,
                    error: 'Invalid device token format',
                    code: 'INVALID_TOKEN'
                };
            } else if (error.reason === 'BadTopic') {
                // Invalid bundle ID
                return {
                    success: false,
                    error: 'Invalid bundle ID',
                    code: 'INVALID_BUNDLE_ID'
                };
            }
            
            return {
                success: false,
                error: error.reason || 'Failed to send iOS notification',
                code: 'APNS_ERROR'
            };
        }

        return {
            success: true,
            message: 'iOS notification sent successfully'
        };
    } catch (error) {
        console.error('APNs Error:', error);
        return {
            success: false,
            error: error.message,
            code: 'APNS_ERROR'
        };
    }
}

// Check if a token is a valid iOS device token
function isValidIOSDeviceToken(token) {
    // Basic validation for iOS device tokens
    // They are typically 64 characters long and contain only hexadecimal characters
    return /^[a-fA-F0-9]{64}$/.test(token);
}

module.exports = {
    sendIOSPushNotification,
    isValidIOSDeviceToken
}; 