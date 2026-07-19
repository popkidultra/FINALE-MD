/**
 * FINALE-MD WhatsApp Bot
 * Rebuilt on @whiskeysockets/baileys (latest stable line)
 */

console.clear()
console.log('📳 Starting FINALE-MD...')

// ============ GLOBAL ANTI-CRASH ============
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason)
})

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys')

const fs = require('fs')
const path = require('path')
const os = require('os')
const P = require('pino')
const qrcode = require('qrcode-terminal')
const express = require('express')

const config = require('./config')
const { sms } = require('./lib/serialize')
const { registerAntiDelete } = require('./lib/antidelete')
const { registerGroupEvents } = require('./lib/groupevents')
const { getGroupAdmins, sleep } = require('./lib/functions')
const { loadSession } = require('./lib/sessionLoader')
const { saveMessage, saveGroupMetadata } = require('./data')
const { commands } = require('./command')

const sessionDir = path.join(__dirname, 'sessions')
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

// ============ TEMP CACHE CLEANUP ============
const tempDir = path.join(os.tmpdir(), 'finale-md-cache')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

setInterval(() => {
  fs.readdir(tempDir, (err, files) => {
    if (err) return
    for (const file of files) fs.unlink(path.join(tempDir, file), () => {})
  })
}, 5 * 60 * 1000)

// ============ SESSION BOOTSTRAP ============
// SESSION_ID is a self-contained base64 string (no external MEGA download,
// no network call needed) — see lib/sessionLoader.js for the accepted
// formats (POPKID~, F~, SILA-MD~, NEXUS___).
async function ensureSession() {
  const credsPath = path.join(sessionDir, 'creds.json')
  if (fs.existsSync(credsPath)) return

  if (!config.SESSION_ID) {
    console.log('⚠️  No SESSION_ID set and no existing session found.')
    console.log('   Either set SESSION_ID in your .env, or scan the QR code that appears below.')
    return
  }

  await loadSession(config.SESSION_ID, sessionDir)
}

// ============ KEEPALIVE SERVER ============
const app = express()
app.get('/', (req, res) => res.send(`${config.BOT_NAME} is active ✅`))
app.listen(config.PORT, () => console.log(`🌐 Server listening on port ${config.PORT}`))

let conn
let reconnectAttempts = 0

// ============ LID RESOLUTION ============
// WhatsApp now routes some senders (non-contacts / privacy-enabled numbers)
// through an @lid identity instead of the classic @s.whatsapp.net JID.
// Baileys can fail to encrypt a reply to a bare @lid if the signal session
// for it hasn't been established yet, so every inbound jid gets normalized
// to its real phone-number JID here before we use it for anything.
async function resolveJid(conn, jid, mekKey = {}) {
  if (!jid || !jid.endsWith('@lid')) return jid

  // 1) Newer Baileys attaches the PN counterpart directly on the message key
  const directPn = mekKey.participantPn || mekKey.senderPn
  if (directPn) return directPn.includes('@') ? directPn : `${directPn}@s.whatsapp.net`

  // 2) Baileys' internal LID<->PN mapping store (if exposed on this version)
  try {
    const mapped = await conn.signalRepository?.lidMapping?.getPNForLID?.(jid)
    if (mapped) return mapped.includes('@') ? mapped : `${mapped}@s.whatsapp.net`
  } catch (e) { /* mapping not available on this version, fall through */ }

  // 3) Legacy/optional helper some Baileys builds expose
  try {
    const resolved = await conn.getJidFromLid?.(jid)
    if (resolved) return resolved
  } catch (e) { /* ignore */ }

  // Nothing resolved — return the original @lid jid so the caller can still
  // try sending to it natively rather than silently dropping the message.
  return jid
}

// Wraps conn.sendMessage so a failed send is logged instead of vanishing,
// and retries once against the resolved real JID if the first attempt to
// an @lid target fails.
async function safeSend(conn, jid, content, options = {}) {
  try {
    return await conn.sendMessage(jid, content, options)
  } catch (e) {
    console.error(`⚠️  sendMessage to ${jid} failed:`, e.message)
    if (jid.endsWith('@lid')) {
      const resolved = await resolveJid(conn, jid)
      if (resolved !== jid) {
        try {
          return await conn.sendMessage(resolved, content, options)
        } catch (e2) {
          console.error(`⚠️  retry sendMessage to ${resolved} also failed:`, e2.message)
        }
      }
    }
    return null
  }
}

async function connectToWA() {
  try {
    console.log('[ ♻️ ] Connecting to WhatsApp...')

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`[ ℹ️ ] Using WA v${version.join('.')}, latest: ${isLatest}`)

    conn = makeWASocket({
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      auth: {
        creds: state.creds,
        // caches signal keys in memory to cut down on disk reads and
        // avoid the decrypt-storm that causes older bots to lag/crash
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
      },
      version
    })

    // ============ ANTICALL ============
    conn.ev.on('call', async (calls) => {
      if (!config.ANTICALL) return
      for (const call of calls) {
        if (call.status === 'offer') {
          console.log(`📞 Declining call from: ${call.from}`)
          await conn.rejectCall(call.id, call.from).catch(() => {})
          await conn.sendMessage(call.from, {
            text: `⚠️ *${config.BOT_NAME}* does not accept calls. Please send a text message instead.`
          }).catch(() => {})
        }
      }
    })

    // ============ CONNECTION LIFECYCLE ============
    conn.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) qrcode.generate(qr, { small: true })

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut

        if (loggedOut) {
          console.log('🔒 Session logged out. Delete the /sessions folder and re-authenticate.')
          return
        }

        reconnectAttempts++
        const delay = Math.min(reconnectAttempts * 3000, 30000)
        console.log(`🔌 Connection closed (code ${statusCode}). Reconnecting in ${delay / 1000}s...`)
        setTimeout(() => connectToWA(), delay)
      } else if (connection === 'open') {
        reconnectAttempts = 0
        console.log('[ ✅ ] FINALE-MD connected to WhatsApp')

        loadPlugins()

        const banner = `╔════════════════╗\n║ 🤖 CONNECTED\n╠════════════════╣\n║ 🔑 Prefix : ${config.PREFIX}\n║ 👨‍💻 Bot    : ${config.BOT_NAME}\n╚════════════════╝`
        conn.sendMessage(conn.user.id, { text: banner }).catch(() => {})

        if (config.AUTO_FOLLOW_CHANNEL) {
          try {
            await conn.newsletterFollow(config.NEWSLETTER_JID)
          } catch (e) {
            console.log('ℹ️  Could not follow newsletter channel:', e.message)
          }
        }
      }
    })

    conn.ev.on('creds.update', saveCreds)

    // ============ AUTO BIO ============
    setInterval(async () => {
      if (!config.AUTO_BIO || !conn?.user) return
      try {
        const date = new Date().toLocaleDateString('en-KE', { timeZone: config.TIMEZONE })
        const time = new Date().toLocaleTimeString('en-KE', { timeZone: config.TIMEZONE, hour12: false })
        await conn.updateProfileStatus(`${config.BOT_NAME} is online 🤖\n📅 ${date} ⏰ ${time}`)
      } catch (e) { /* non-fatal */ }
    }, 60000)

    registerAntiDelete(conn)
    registerGroupEvents(conn)

    // ============ MESSAGE HANDLER ============
    conn.ev.on('messages.upsert', async (upsert) => {
      try {
        let mek = upsert.messages[0]
        if (!mek?.message) return

        mek.message = getContentType(mek.message) === 'ephemeralMessage'
          ? mek.message.ephemeralMessage.message
          : mek.message

        let from = mek.key.remoteJid
        const type = getContentType(mek.message)

        // ---- Status broadcast handling ----
        if (from === 'status@broadcast') {
          await handleStatus(conn, mek, type)
          return
        }

        // Normalize an @lid chat/sender to its real phone-number JID up front
        // so every downstream check (owner, admin, reply target) is reliable.
        from = await resolveJid(conn, from, mek.key)
        if (mek.key.participant) {
          mek.key.participant = await resolveJid(conn, mek.key.participant, mek.key)
        }
        mek.key.remoteJid = from

        if (config.READ_MESSAGE) await conn.readMessages([mek.key]).catch(() => {})
        await saveMessage(mek)

        const m = sms(conn, mek)
        const body =
          type === 'conversation' ? mek.message.conversation :
          type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
          type === 'imageMessage' ? (mek.message.imageMessage.caption || '') :
          type === 'videoMessage' ? (mek.message.videoMessage.caption || '') : ''

        const isCmd = body.startsWith(config.PREFIX)
        const command = isCmd ? body.slice(config.PREFIX.length).trim().split(' ').shift().toLowerCase() : ''
        const args = body.trim().split(/ +/).slice(1)
        const text = args.join(' ')
        const isGroup = from.endsWith('@g.us')
        const sender = mek.key.fromMe
          ? jidNormalizedUser(conn.user.id)
          : (mek.key.participant || from)
        const senderNumber = sender.split('@')[0]
        const isOwner = config.OWNER_NUMBER.includes(senderNumber) || mek.key.fromMe
        const pushname = mek.pushName || 'User'
        const botNumber = jidNormalizedUser(conn.user.id)

        let groupMetadata = null, participants = [], groupAdmins = [], isBotAdmin = false, isAdmin = false
        if (isGroup) {
          groupMetadata = await conn.groupMetadata(from).catch(() => null)
          if (groupMetadata) {
            saveGroupMetadata(from, groupMetadata)
            participants = groupMetadata.participants || []
            groupAdmins = getGroupAdmins(participants)
            isBotAdmin = groupAdmins.includes(botNumber)
            isAdmin = groupAdmins.includes(sender)
          }
        }

        const reply = (teks) => safeSend(conn, from, { text: teks }, { quoted: mek })

        if (!mek.key.fromMe && config.AUTO_REACT) {
          const emojis = ['🌼', '❤️', '💐', '🔥', '🏵️', '❄️', '💥']
          safeSend(conn, from, { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: mek.key } })
        }

        if (!isCmd) return
        const cmdDef = commands.find(c => c.pattern === command || (c.alias && c.alias.includes(command)))
        if (!cmdDef) return

        if (cmdDef.ownerOnly && !isOwner) return reply('🚫 This command is for the bot owner only.')
        if (cmdDef.groupOnly && !isGroup) return reply('🚫 This command only works in groups.')
        if (cmdDef.adminOnly && isGroup && !isAdmin && !isOwner) return reply('🚫 This command is for group admins only.')

        if (cmdDef.react) safeSend(conn, from, { react: { text: cmdDef.react, key: mek.key } })

        try {
          await cmdDef.function(conn, mek, m, {
            from, body, isCmd, command, args, text, isGroup,
            sender, senderNumber, botNumber, pushname, isOwner,
            groupMetadata, participants, groupAdmins, isBotAdmin, isAdmin, reply
          })
        } catch (e) {
          console.error(`❌ Error in command "${command}":`, e)
          reply(`❌ Something went wrong running that command.`).catch(() => {})
        }
      } catch (e) {
        console.error('❌ messages.upsert handler error:', e)
      }
    })
  } catch (err) {
    console.error('❌ Connection failed, retrying in 10s:', err)
    setTimeout(() => connectToWA(), 10000)
  }
}

// ============ STATUS (STORY) HANDLER ============
async function handleStatus(conn, mek, type) {
  try {
    const statusParticipant = mek.key.participant || null
    if (!statusParticipant) return

    // Resolve an @lid participant to a real phone-number JID where possible
    const realJid = await resolveJid(conn, statusParticipant, mek.key)
    const resolvedKey = { ...mek.key, participant: realJid }

    if (config.AUTO_READ_STATUS) await conn.readMessages([resolvedKey]).catch(() => {})

    if (config.AUTO_REACT_STATUS) {
      const reactable = ['imageMessage', 'videoMessage', 'extendedTextMessage', 'conversation', 'audioMessage']
      if (reactable.includes(type)) {
        const emojis = ['🧩', '🍉', '💜', '🌸', '🪴', '💫', '🌟', '🎋']
        const emoji = emojis[Math.floor(Math.random() * emojis.length)]
        await safeSend(conn, 'status@broadcast', { react: { key: resolvedKey, text: emoji } }, {
          statusJidList: [realJid, conn.user.id]
        })
      }
    }

    if (config.AUTO_STATUS_REPLY) {
      await safeSend(conn, realJid, { text: config.AUTO_STATUS_MSG }, { quoted: mek })
    }
  } catch (e) {
    console.error('❌ Status handler error:', e.message)
  }
}

// ============ PLUGIN LOADER ============
let pluginsLoaded = false
function loadPlugins() {
  if (pluginsLoaded) return
  pluginsLoaded = true
  const pluginDir = path.join(__dirname, 'plugins')
  if (!fs.existsSync(pluginDir)) return

  let count = 0
  for (const file of fs.readdirSync(pluginDir)) {
    if (path.extname(file).toLowerCase() !== '.js') continue
    try {
      require(path.join(pluginDir, file))
      count++
    } catch (e) {
      console.error(`❌ Failed to load plugin ${file}:`, e.message)
    }
  }
  console.log(`[ 🔌 ] Loaded ${count} plugin file(s), ${commands.length} command(s) registered.`)
}

// ============ BOOT ============
;(async () => {
  await ensureSession()
  await sleep(500)
  connectToWA()
})()
