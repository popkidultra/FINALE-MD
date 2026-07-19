const { cmd } = require('../command')
const { setAnti, getAnti } = require('../data')

cmd({
  pattern: 'antidelete',
  desc: 'Toggle anti-delete for this chat (on/off)',
  category: 'owner',
  ownerOnly: true
}, async (conn, mek, m, { args, reply }) => {
  const choice = (args[0] || '').toLowerCase()
  if (!['on', 'off'].includes(choice)) {
    const state = getAnti(m.chat) ? 'ON' : 'OFF'
    return reply(`Anti-delete is currently *${state}* for this chat.\nUse: ${''}antidelete on | off`)
  }
  setAnti(m.chat, choice === 'on')
  await reply(`✅ Anti-delete turned *${choice.toUpperCase()}* for this chat.`)
})

cmd({
  pattern: 'restart',
  desc: 'Restart the bot process (requires a process manager to bring it back up)',
  category: 'owner',
  ownerOnly: true
}, async (conn, mek, m, { reply }) => {
  await reply('♻️ Restarting...')
  process.exit(0)
})
