const { cmd, commands } = require('../command')
const config = require('../config')

cmd({
  pattern: 'menu',
  alias: ['help', 'list'],
  desc: 'Show all available commands',
  category: 'general',
  react: '📜'
}, async (conn, mek, m, { reply }) => {
  const byCategory = {}
  for (const c of commands) {
    const cat = c.category || 'misc'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(c.pattern)
  }

  let text = `📜 *${config.BOT_NAME} MENU*\nPrefix: ${config.PREFIX}\n\n`
  for (const [cat, cmds] of Object.entries(byCategory)) {
    text += `*${cat.toUpperCase()}*\n`
    text += cmds.map(c => `  • ${config.PREFIX}${c}`).join('\n')
    text += '\n\n'
  }

  await reply(text.trim())
})
