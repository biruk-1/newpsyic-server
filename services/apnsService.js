const apn = require('apn');
const path = require('path');
const fs = require('fs');

const apnsKeyPath = path.join(__dirname, '../certs', 'AuthKey.p8');
const keyFileExists = fs.existsSync(apnsKeyPath);

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

async function sendIOSPushNotification(deviceToken, notification) {
    if (!keyFileExists) {
        console.error('APNs key file not found at', apnsKeyPath);
        return {
            success: false,
            error: 'APNs key file not found. iOS push notifications are disabled.',
            code: 'KEY_FILE_MISSING'
        };
    }

    try {
        const note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600;
        note.badge = 1;
        note.sound = "default";
        note.alert = {
            title: notification.title,
            body: notification.body
        };
        note.payload = {
            ...notification.data,
            type: notification.type,
            timestamp: new Date().toISOString()
        };
        note.topic = process.env.APNS_BUNDLE_ID;
        note.contentAvailable = 1; // Added for background handling

        console.log(`Sending iOS notification to ${deviceToken}:`, note.alert);
        const result = await apnProvider.send(note, deviceToken);
        
        if (result.failed.length > 0) {
            console.error('APNs Error:', result.failed[0].response);
            const error = result.failed[0].response;
            if (error.reason === 'Unregistered') {
                console.log(`Device token ${deviceToken} unregistered`);
                return {
                    success: false,
                    error: 'Device token is no longer valid',
                    code: 'DEVICE_NOT_REGISTERED'
                };
            } else if (error.reason === 'BadDeviceToken') {
                console.log(`Bad device token ${deviceToken}`);
                return {
                    success: false,
                    error: 'Invalid device token format',
                    code: 'INVALID_TOKEN'
                };
            } else if (error.reason === 'BadTopic') {
                console.log(`Invalid bundle ID for token ${deviceToken}`);
                return {
                    success: false,
                    error: 'Invalid bundle ID',
                    code: 'INVALID_BUNDLE_ID'
                };
            }
            console.log(`APNs failed for ${deviceToken}: ${error.reason}`);
            return {
                success: false,
                error: error.reason || 'Failed to send iOS notification',
                code: 'APNS_ERROR'
            };
        }

        console.log(`iOS notification sent successfully to ${deviceToken}`);
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

function isValidIOSDeviceToken(token) {
    const isValid = /^[a-fA-F0-9]{64}$/.test(token);
    console.log(`Validating iOS token ${token}: ${isValid}`);
    return isValid;
}

module.exports = {
    sendIOSPushNotification,
    isValidIOSDeviceToken
};