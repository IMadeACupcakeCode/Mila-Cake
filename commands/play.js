const tocar = require('./tocar');
module.exports = { ...tocar, data: { ...tocar.data, name: 'play', description: 'Play a song from YouTube, Spotify or SoundCloud' } };
