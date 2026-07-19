const { getContentType, downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys')

// Wraps a raw upsert message with convenience helpers used by plugins.
function sms(conn, mek) {
  if (!mek) return mek
  const type = getContentType(mek.message || {})
  const m = { ...mek }

  m.key = mek.key
  m.id = mek.key.id
  m.chat = mek.key.remoteJid
  m.isGroup = m.chat?.endsWith('@g.us') || false
  m.sender = mek.key.fromMe
    ? jidNormalizedUser(conn.user.id)
    : (mek.key.participant || mek.key.remoteJid)
  m.pushName = mek.pushName || 'User'
  m.type = type

  m.reply = (text, opts = {}) => conn.sendMessage(m.chat, { text }, { quoted: mek, ...opts })

  m.react = (emoji) => conn.sendMessage(m.chat, { react: { text: emoji, key: mek.key } })

  m.download = async () => {
    const content = mek.message?.[type]
    if (!content) return null
    const mediaType = type.replace('Message', '')
    const stream = await downloadContentFromMessage(content, mediaType)
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
  }

  return m
}

// Standalone media downloader for arbitrary message objects (e.g. quoted messages)
async function downloadMediaMessage(message, mediaType) {
  const stream = await downloadContentFromMessage(message, mediaType)
  let buffer = Buffer.from([])
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

module.exports = { sms, downloadMediaMessage }
