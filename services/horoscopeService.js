const { supabase } = require('../supabaseClient');
const { sendPushNotification } = require('./notificationService');

// Function to get horoscope for a specific zodiac sign
async function getHoroscopeForSign(sign) {
  // TODO: Integrate with your horoscope API
  return {
    sign,
    prediction: "Your daily horoscope prediction here",
    date: new Date().toISOString()
  };
}

// Function to send daily horoscope to a user
async function sendDailyHoroscope(userId) {
  try {
    // Get user's birth details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('birth_date, notification_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Check if user has enabled daily horoscope notifications
    if (!user.notification_preferences?.dailyHoroscope) { // Changed from daily_horoscope
      return { success: false, error: 'Daily horoscope notifications disabled' };
    }

    // Calculate zodiac sign from birth date
    const birthDate = new Date(user.birth_date);
    const zodiacSign = calculateZodiacSign(birthDate);

    // Get horoscope for the sign
    const horoscope = await getHoroscopeForSign(zodiacSign);

    // Send notification
    return await sendPushNotification(userId, {
      type: 'dailyHoroscope',
      title: `Daily Horoscope for ${zodiacSign}`,
      body: horoscope.prediction,
      data: {
        sign: zodiacSign,
        date: horoscope.date
      }
    });
  } catch (error) {
    console.error('Error sending daily horoscope:', error);
    return { success: false, error: error.message };
  }
}

// Function to send daily horoscopes to all users
async function sendDailyHoroscopesToAll() {
  try {
    // Get all users with daily horoscope notifications enabled
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('notification_preferences->dailyHoroscope', true); // Changed from daily_horoscope

    if (error) {
      return { success: false, error: 'Error fetching users' };
    }

    const results = [];
    for (const user of users) {
      const result = await sendDailyHoroscope(user.id);
      results.push({ userId: user.id, ...result });
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error sending daily horoscopes:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to calculate zodiac sign
function calculateZodiacSign(birthDate) {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

module.exports = {
  sendDailyHoroscope,
  sendDailyHoroscopesToAll
};