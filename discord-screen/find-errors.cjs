const fs = require('fs');
const files = ['client/src/main.js', 'server/index.js', 'shared/broadcaster.js', 'shared/rtc.js'];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for backslash at start of a comment that should be //
    if (/^\s*\\/.test(line) && !/^\s*\\.*\\/.test(line) && !/^\s*\\\\/.test(line)) {
      console.log(f + ':' + (i+1) + ': ' + line);
    }
  }
}
