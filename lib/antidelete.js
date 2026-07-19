const config = require('../config')
const { loadMessage, getAnti } = require('../data')

function registerAntiDelete(conn) {
  conn.ev.on('messages.update', async (updates) => {
    if (!config.ANTIDELETE) return

    for (const { key, update } of updates) {
      try {
        const isRevoke = update?.messageStubType === 68 /* REVOKE */ || update?.message === null
        if (!isRevoke) continue
        if (!key?.remoteJid) continue
        if (getAnti(key.remoteJid) === false) continue

        const cached = loadMessage(key.remoteJid, key.id)
        if (!cached) continue

        const deletedBy = key.participant || key.remoteJid
        const notifyJid = key.remoteJid

        const header = `🗑️ *Anti-Delete*\nDeleted by: @${deletedBy.split('@')[0]}\nOriginal message from: ${cached.pushName || 'Unknown'}`

        await conn.sendMessage(notifyJid, {
          text: header,
          mentions: [deletedBy]
        })

        // Re-send the original content when possible
        if (cached.message?.conversation || cached.message?.extendedTextMessage) {
          const text = cached.message.conversation || cached.message.extendedTextMessage.text
          await conn.sendMessage(notifyJid, { text: `💬 ${text}` })
        } else if (cached.message) {
          // For media, forward the raw message content back to the chat
          await conn.relayMessage(notifyJid, cached.message, {})
        }
      } catch (e) {
        console.error('[antidelete] error:', e.message)
      }
    }
  })
}

module.exports = { registerAntiDelete }
