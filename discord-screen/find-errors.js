const fs = require('fs');
const files = ['client/src/main.js', 'server/index.js', 'shared/broadcaster.js', 'shared/rtc.js'];
for (const f of files) {
  const full = 'discord-screen/' + f;
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Line starts with a backslash (not double backslash = escaped, not //)
    if (lines[i].match(/^\s*\\[^/]/) && !lines[i].match(/^\s*\\\\/)) {
      console.log(full + ':' + (i+1) + ': ' + lines[i]);
    }
  }
}
