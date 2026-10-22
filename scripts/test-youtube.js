const assert = require('assert/strict');
const { isVideoId, parseYouTubeUrl } = require('../utils/youtube');

const ID = 'dQw4w9WgXcQ';

assert.equal(isVideoId(ID), true);
assert.equal(isVideoId('curto'), false);
assert.equal(parseYouTubeUrl(ID), ID);
assert.equal(parseYouTubeUrl(`  ${ID}  `), ID);
assert.equal(parseYouTubeUrl(`<https://youtu.be/${ID}>`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://youtube.com/watch?feature=share&v=${ID}&t=42`), ID);
assert.equal(parseYouTubeUrl(`https://m.youtube.com/watch?v=${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://music.youtube.com/watch?v=${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://youtu.be/${ID}?si=abc`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube-nocookie.com/embed/${ID}`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube.com/live/${ID}?feature=share`), ID);
assert.equal(parseYouTubeUrl(`https://www.youtube.com/v/${ID}`), ID);

assert.equal(parseYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), null);
assert.equal(parseYouTubeUrl('https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), null);
assert.equal(parseYouTubeUrl('javascript:alert(1)'), null);
assert.equal(parseYouTubeUrl('ftp://youtube.com/watch?v=dQw4w9WgXcQ'), null);
assert.equal(parseYouTubeUrl('https://www.youtube.com/playlist?list=PL123'), null);
assert.equal(parseYouTubeUrl('https://www.youtube.com/watch?v=curto'), null);
assert.equal(parseYouTubeUrl('https://youtu.be/'), null);
assert.equal(parseYouTubeUrl(''), null);
assert.equal(parseYouTubeUrl(null), null);

console.log('YouTube URL smoke tests: OK');
