require('dotenv').config()

function bool(val, def = false) {
  if (val === undefined || val === null || val === '') return def
  return val.toString().trim().toLowerCase() === 'true'
}

module.exports = {
  // Session
  SESSION_ID: process.env.SESSION_ID || '',

  // Identity
  BOT_NAME: process.env.BOT_NAME || 'FINALE-MD',
  PREFIX: process.env.PREFIX || '.',
  OWNER_NUMBER: (process.env.OWNER_NUMBER || '254732297194').split(',').map(n => n.trim()),

  // Toggles
  AUTO_READ_STATUS: bool(process.env.AUTO_READ_STATUS, true),
  AUTO_REACT_STATUS: bool(process.env.AUTO_REACT_STATUS, false),
  AUTO_STATUS_REPLY: bool(process.env.AUTO_STATUS_REPLY, false),
  AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || 'Auto-viewed by FINALE-MD ✅',
  AUTO_REACT: bool(process.env.AUTO_REACT, false),
  AUTO_BIO: bool(process.env.AUTO_BIO, false),
  READ_MESSAGE: bool(process.env.READ_MESSAGE, false),
  ANTICALL: bool(process.env.ANTICALL, true),
  ANTIDELETE: bool(process.env.ANTIDELETE, true),
  AUTO_FOLLOW_CHANNEL: bool(process.env.AUTO_FOLLOW_CHANNEL, true),
  NEWSLETTER_JID: process.env.NEWSLETTER_JID || '120363423997837331@newsletter',

  // Misc
  ALIVE_IMG: process.env.ALIVE_IMG || 'https://files.catbox.moe/j9ia5c.png',
  TIMEZONE: process.env.TIMEZONE || 'Africa/Nairobi',
  PORT: process.env.PORT || 9090
}
