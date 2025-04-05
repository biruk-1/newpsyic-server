const cron = require('node-cron');
const { sendDailyHoroscopesToAll } = require('./horoscopeService');
const { supabase } = require('../supabaseClient');

// Schedule daily horoscope notifications
function scheduleDailyHoroscopes() {
  // Run at 8:00 AM every day
  cron.schedule('0 8 * * *', async () => {
    console.log('Sending daily horoscopes...');
    const result = await sendDailyHoroscopesToAll();
    console.log('Daily horoscopes sent:', result);
  });
}

// Schedule moon phase notifications
function scheduleMoonPhaseNotifications() {
  // Run at 9:00 AM every day
  cron.schedule('0 9 * * *', async () => {
    try {
      // Get users with moon phase notifications enabled
      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('notification_preferences->moonPhases', true);

      if (error) {
        console.error('Error fetching users for moon phase notifications:', error);
        return;
      }

      // TODO: Get moon phase data from your astrology API
      const moonPhase = {
        phase: 'Full Moon',
        date: new Date().toISOString(),
        description: 'Today is a Full Moon...'
      };

      // Send notifications to each user
      for (const user of users) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'moonPhase',
          title: 'Moon Phase Update',
          message: moonPhase.description,
          data: {
            phase: moonPhase.phase,
            date: moonPhase.date
          }
        });
      }
    } catch (error) {
      console.error('Error sending moon phase notifications:', error);
    }
  });
}

// Schedule planetary transit notifications
function schedulePlanetaryTransitNotifications() {
  // Run at 10:00 AM every day
  cron.schedule('0 10 * * *', async () => {
    try {
      // Get users with planetary transit notifications enabled
      const { data: users, error } = await supabase
        .from('users')
        .select('id, birth_date')
        .eq('notification_preferences->planetaryTransits', true);

      if (error) {
        console.error('Error fetching users for planetary transit notifications:', error);
        return;
      }

      // TODO: Get planetary transit data from your astrology API
      const transit = {
        planet: 'Mercury',
        aspect: 'Conjunction',
        date: new Date().toISOString(),
        description: 'Mercury is in conjunction...'
      };

      // Send notifications to each user
      for (const user of users) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'planetaryTransit',
          title: 'Planetary Transit Alert',
          message: transit.description,
          data: {
            planet: transit.planet,
            aspect: transit.aspect,
            date: transit.date
          }
        });
      }
    } catch (error) {
      console.error('Error sending planetary transit notifications:', error);
    }
  });
}

// Initialize all schedulers
function initializeSchedulers() {
  scheduleDailyHoroscopes();
  scheduleMoonPhaseNotifications();
  schedulePlanetaryTransitNotifications();
  console.log('All notification schedulers initialized');
}

module.exports = {
  initializeSchedulers
}; 