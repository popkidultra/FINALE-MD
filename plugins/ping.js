const { cmd } = require('../command')

cmd({
  pattern: 'ping',
  alias: ['speed'],
  desc: 'Check bot response speed',
  category: 'general',
  react: '🏓'
}, async (conn, mek, m, { reply }) => {
  const start = Date.now()
  const sent = await conn.sendMessage(m.chat, { text: '🏓 Pinging...' }, { quoted: mek })
  const latency = Date.now() - start
  await conn.sendMessage(m.chat, { text: `🏓 *Pong!* ${latency}ms`, edit: sent.key })
})
