const { cmd } = require('../command')
const { runtime } = require('../lib/functions')
const config = require('../config')
const os = require('os')

cmd({
  pattern: 'uptime',
  alias: ['up', 'stats'],
  desc: 'Check bot uptime & stats',
  category: 'general',
  react: '💻'
}, async (conn, mek, m, { reply }) => {
  
  const up = process.uptime()
  const d = Math.floor(up / 86400)
  const h = Math.floor((up % 86400) / 3600)
  const min = Math.floor((up % 3600) / 60)
  const s = Math.floor(up % 60)
  
  const ram = ((os.totalmem() - os.freemem()) / 1e9).toFixed(1)
  const totalRam = (os.totalmem() / 1e9).toFixed(1)
  const cpu = os.loadavg()[0].toFixed(1)

  const text = `╔══════════════════╗
║  ⚡ ${config.BOT_NAME}
╠══════════════════╣
║ ⏱️  ${d}d ${h}h ${min}m ${s}s
║ 💾  ${ram}/${totalRam} GB
║ 🖥️  ${cpu}% CPU
║ 🔑  ${config.PREFIX}
╚══════════════════╝`

  await conn.sendMessage(m.chat, { 
    image: { url: config.ALIVE_IMG }, 
    caption: text 
  }, { quoted: mek })
})
