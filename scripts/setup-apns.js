const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('APNs Setup Script');
console.log('================');
console.log('This script will help you set up your APNs key file for iOS push notifications.');
console.log('');

// Check if the certs directory exists
const certsDir = path.join(__dirname, '../certs');
if (!fs.existsSync(certsDir)) {
  console.log('Creating certs directory...');
  fs.mkdirSync(certsDir, { recursive: true });
}

// Ask for the path to the .p8 file
rl.question('Enter the path to your AuthKey.p8 file: ', (p8Path) => {
  try {
    // Check if the file exists
    if (!fs.existsSync(p8Path)) {
      console.error('Error: File not found at the specified path.');
      rl.close();
      return;
    }

    // Copy the file to the certs directory
    const destPath = path.join(certsDir, 'AuthKey.p8');
    fs.copyFileSync(p8Path, destPath);
    
    console.log('');
    console.log('Success! Your APNs key file has been set up.');
    console.log(`File copied to: ${destPath}`);
    console.log('');
    console.log('Make sure your .env file contains the following variables:');
    console.log(`APNS_KEY_ID=3J733VT4RV`);
    console.log(`APNS_TEAM_ID=P4R37P8JLK`);
    console.log(`APNS_BUNDLE_ID=com.biruk123.boltexponativewind`);
    console.log('');
    console.log('You can now restart your server to apply these changes.');
    
    rl.close();
  } catch (error) {
    console.error('Error setting up APNs key file:', error.message);
    rl.close();
  }
}); 