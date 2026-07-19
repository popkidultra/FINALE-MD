const { readJSON, writeJSON } = require('./db')

// ============ ANTI-DELETE SETTINGS ============
// per-chat toggle: { [jid]: true/false }
let antiDeleteSettings = readJSON('antidelete', {})

function initializeAntiDeleteSettings() {
  antiDeleteSettings = readJSON('antidelete', {})
}

function setAnti(jid, value) {
  antiDeleteSettings[jid] = value
  writeJSON('antidelete', antiDeleteSettings)
}

function getAnti(jid) {
  return antiDeleteSettings[jid] ?? true
}

function getAllAntiDeleteSettings() {
  return antiDeleteSettings
}

// AntiDelDB kept as a thin wrapper for backward compatibility with plugins
// that expect a lowdb-style object with .data
const AntiDelDB = {
  get data() {
    return antiDeleteSettings
  },
  write() {
    writeJSON('antidelete', antiDeleteSettings)
  }
}

// ============ MESSAGE STORE (for anti-delete / quoted lookups) ============
// capped ring buffer per chat to avoid unbounded memory/disk growth
const MAX_MESSAGES_PER_CHAT = 200
let messageStore = readJSON('messages', {})

async function saveMessage(mek) {
  try {
    const jid = mek.key.remoteJid
    if (!jid) return
    if (!messageStore[jid]) messageStore[jid] = []
    messageStore[jid].push({
      id: mek.key.id,
      fromMe: mek.key.fromMe,
      participant: mek.key.participant || null,
      message: mek.message,
      pushName: mek.pushName || null,
      timestamp: Date.now()
    })
    if (messageStore[jid].length > MAX_MESSAGES_PER_CHAT) {
      messageStore[jid] = messageStore[jid].slice(-MAX_MESSAGES_PER_CHAT)
    }
    await writeJSON('messages', messageStore)
  } catch (e) {
    console.error('[db] saveMessage error:', e.message)
  }
}

function loadMessage(jid, id) {
  const chat = messageStore[jid]
  if (!chat) return null
  return chat.find(m => m.id === id) || null
}

// ============ CONTACTS ============
let contacts = readJSON('contacts', {})

function saveContact(jid, data) {
  contacts[jid] = { ...(contacts[jid] || {}), ...data }
  writeJSON('contacts', contacts)
}

function getName(jid) {
  return contacts[jid]?.name || contacts[jid]?.notify || jid?.split('@')[0] || 'Unknown'
}

// ============ GROUP METADATA CACHE ============
let groupMetaCache = readJSON('groups', {})

function saveGroupMetadata(jid, metadata) {
  groupMetaCache[jid] = { metadata, cachedAt: Date.now() }
  writeJSON('groups', groupMetaCache)
}

function getGroupMetadata(jid) {
  return groupMetaCache[jid]?.metadata || null
}

// ============ MESSAGE COUNTS (per group, per participant) ============
let messageCounts = readJSON('messagecounts', {})

function saveMessageCount(groupJid, participant) {
  if (!messageCounts[groupJid]) messageCounts[groupJid] = {}
  messageCounts[groupJid][participant] = (messageCounts[groupJid][participant] || 0) + 1
  writeJSON('messagecounts', messageCounts)
}

function getGroupMembersMessageCount(groupJid) {
  return messageCounts[groupJid] || {}
}

function getInactiveGroupMembers(groupJid, participants) {
  const counts = messageCounts[groupJid] || {}
  return participants.filter(p => !counts[p.id || p])
}

// ============ CHAT SUMMARY (lightweight, best-effort) ============
function getChatSummary(jid) {
  const chat = messageStore[jid] || []
  return {
    totalCached: chat.length,
    lastMessageAt: chat.length ? chat[chat.length - 1].timestamp : null
  }
}

module.exports = {
  AntiDelDB,
  initializeAntiDeleteSettings,
  setAnti,
  getAnti,
  getAllAntiDeleteSettings,
  saveContact,
  loadMessage,
  getName,
  getChatSummary,
  saveGroupMetadata,
  getGroupMetadata,
  saveMessageCount,
  getInactiveGroupMembers,
  getGroupMembersMessageCount,
  saveMessage
}
