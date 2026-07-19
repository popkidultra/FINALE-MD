const { cmd } = require('../command')

cmd({
  pattern: 'kick',
  desc: 'Remove a mentioned/replied user from the group',
  category: 'group',
  groupOnly: true,
  adminOnly: true
}, async (conn, mek, m, { reply }) => {
  const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid
  const quoted = mek.message?.extendedTextMessage?.contextInfo?.participant
  const target = (mentioned && mentioned[0]) || quoted
  if (!target) return reply('Tag or reply to the user you want to remove.')
  await conn.groupParticipantsUpdate(m.chat, [target], 'remove')
})

cmd({
  pattern: 'promote',
  desc: 'Promote a mentioned/replied user to admin',
  category: 'group',
  groupOnly: true,
  adminOnly: true
}, async (conn, mek, m, { reply }) => {
  const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid
  const quoted = mek.message?.extendedTextMessage?.contextInfo?.participant
  const target = (mentioned && mentioned[0]) || quoted
  if (!target) return reply('Tag or reply to the user you want to promote.')
  await conn.groupParticipantsUpdate(m.chat, [target], 'promote')
})

cmd({
  pattern: 'demote',
  desc: 'Demote a mentioned/replied admin',
  category: 'group',
  groupOnly: true,
  adminOnly: true
}, async (conn, mek, m, { reply }) => {
  const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid
  const quoted = mek.message?.extendedTextMessage?.contextInfo?.participant
  const target = (mentioned && mentioned[0]) || quoted
  if (!target) return reply('Tag or reply to the admin you want to demote.')
  await conn.groupParticipantsUpdate(m.chat, [target], 'demote')
})

cmd({
  pattern: 'tagall',
  desc: 'Mention every member of the group',
  category: 'group',
  groupOnly: true,
  adminOnly: true
}, async (conn, mek, m, { args, groupMetadata, text, reply }) => {
  const participants = groupMetadata?.participants || []
  const msg = text || 'Attention everyone!'
  const mentions = participants.map(p => p.id)
  const body = participants.map(p => `@${p.id.split('@')[0]}`).join(' ')
  await conn.sendMessage(m.chat, { text: `${msg}\n\n${body}`, mentions }, { quoted: mek })
})
