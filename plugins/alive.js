const { cmd } = require('../command')
const { runtime } = require('../lib/functions')
const config = require('../config')

cmd({
  pattern: 'alive',
  alias: ['status'],
  desc: 'Check if the bot is running',
  category: 'general',
  react: '💚'
}, async (conn, mek, m, { reply }) => {
  const text = `╔════════════════╗\n║ 💚 *${config.BOT_NAME}*\n╠════════════════╣\n║ ⏱️ Uptime: ${runtime(process.uptime())}\n║ 🔑 Prefix: ${config.PREFIX}\n╚════════════════╝`
  await conn.sendMessage(m.chat, { image: { url: config.ALIVE_IMG }, caption: text }, { quoted: mek })
})
