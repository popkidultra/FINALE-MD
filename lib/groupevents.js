const config = require('../config')
const { getGroupMetadata, saveGroupMetadata } = require('../data')

function registerGroupEvents(conn) {
  conn.ev.on('group-participants.update', async (event) => {
    try {
      const { id, participants, action } = event
      let metadata = getGroupMetadata(id)
      if (!metadata) {
        metadata = await conn.groupMetadata(id).catch(() => null)
        if (metadata) saveGroupMetadata(id, metadata)
      }
      if (!metadata) return

      const groupName = metadata.subject || 'this group'

      for (const participant of participants) {
        const user = `@${participant.split('@')[0]}`
        if (action === 'add') {
          await conn.sendMessage(id, {
            text: `👋 Welcome ${user} to *${groupName}*!`,
            mentions: [participant]
          })
        } else if (action === 'remove') {
          await conn.sendMessage(id, {
            text: `👋 ${user} has left *${groupName}*.`,
            mentions: [participant]
          })
        } else if (action === 'promote') {
          await conn.sendMessage(id, {
            text: `⬆️ ${user} was promoted to admin.`,
            mentions: [participant]
          })
        } else if (action === 'demote') {
          await conn.sendMessage(id, {
            text: `⬇️ ${user} was demoted from admin.`,
            mentions: [participant]
          })
        }
      }

      // refresh cache after any change
      const fresh = await conn.groupMetadata(id).catch(() => null)
      if (fresh) saveGroupMetadata(id, fresh)
    } catch (e) {
      console.error('[groupevents] error:', e.message)
    }
  })
}

module.exports = { registerGroupEvents }
