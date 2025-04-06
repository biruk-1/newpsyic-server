const apn = require('apn');
const path = require('path');
const fs = require('fs');

// Check if the APNs key file exists
const apnsKeyPath = path.join(__dirname, '../certs', 'AuthKey.p8');
const keyFileExists = fs.existsSync(apnsKeyPath);

// Initialize APNs provider only if the key file exists
let apnProvider = null;
if (keyFileExists) {
    apnProvider = new apn.Provider({
        token: {
            key: apnsKeyPath,
            keyId: process.env.APNS_KEY_ID,
            teamId: process.env.APNS_TEAM_ID,
        },
        production: process.env.NODE_ENV === 'production',
        bundleId: process.env.APNS_BUNDLE_ID
    });
}

// Send iOS push notification
async function sendIOSPushNotification(deviceToken, notification) {
    // If the key file doesn't exist, return an error
    if (!keyFileExists) {
        console.error('APNs key file not found. iOS push notifications are disabled.');
        return {
            success: false,
            error: 'APNs key file not found. iOS push notifications are disabled.',
            code: 'KEY_FILE_MISSING'
        };
    }

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