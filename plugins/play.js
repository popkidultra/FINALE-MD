const { cmd } = require('../command')
const axios = require('axios')
const config = require('../config')

cmd({
  pattern: 'play',
  alias: ['song', 'music', 'audio', 'ytmp3'],
  desc: 'Search & download music',
  category: 'download',
  react: '🎵'
}, async (conn, mek, m, { reply, args, from }) => {
  
  const query = args.join(' ')
  if (!query) return reply(`╔══════════════════╗
║  ❌ *MISSING QUERY*
╠══════════════════╣
║ 🎵 .play <song name>
║ 📌 Example:
║ .play Faded Alan Walker
╚══════════════════╝`)

  // Loading animation
  const loading = await conn.sendMessage(from, {
    text: `╔══════════════════╗
║  🔍 *SEARCHING...*
╠══════════════════╣
║ 🎵 ${query}
║ ⏳ Please wait...
╚══════════════════╝`
  }, { quoted: mek })

  let audioUrl = null
  let title = query
  let thumbnail = null

  // Strategy Chain
  const strategies = [
    
    // 1. Siputzx Search + YTMP3
    async () => {
      const search = await axios.get(
        `https://api.siputzx.my.id/api/s/ytsearch?query=${encodeURIComponent(query)}`,
        { timeout: 12000 }
      )
      const video = search.data?.data?.[0]
      if (!video?.url) throw new Error('no result')
      
      const dl = await axios.get(
        `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(video.url)}`,
        { timeout: 30000 }
      )
      const url = dl.data?.data?.url || dl.data?.url
      if (!url) throw new Error('no audio')
      
      return {
        url,
        title: video.title || query,
        thumbnail: video.thumbnail || null
      }
    },

    // 2. RapidAPI YT-Search-Download
    async () => {
      const search = await axios.get(
        `https://api.siputzx.my.id/api/s/ytsearch?query=${encodeURIComponent(query)}`,
        { timeout: 12000 }
      )
      const video = search.data?.data?.[0]
      if (!video?.title) throw new Error('no result')

      const dl = await axios.get(
        'https://yt-search-and-download-mp3.p.rapidapi.com/mp3',
        {
          params: { q: video.title },
          headers: {
            'x-rapidapi-key': '6ef072907amshd7a657ee1c67d4ep1c4c33jsnac96a98cacb4',
            'x-rapidapi-host': 'yt-search-and-download-mp3.p.rapidapi.com'
          },
          timeout: 30000
        }
      )
      if (!dl.data?.success || !dl.data?.download) throw new Error('no url')
      
      return {
        url: dl.data.download,
        title: video.title || query,
        thumbnail: video.thumbnail || null
      }
    },

    // 3. Prexzyvilla Spotify
    async () => {
      const dl = await axios.get(
        `https://prexzyapis.com/download/spotify?url=${encodeURIComponent(query)}`,
        { timeout: 60000 }
      )
      const url = dl.data?.download_url || dl.data?.url || dl.data?.audio
      if (!url) throw new Error('no audio')
      
      return {
        url,
        title: dl.data?.title || query,
        thumbnail: dl.data?.thumbnail || dl.data?.image || null
      }
    },

    // 4. YtDlp Worker
    async () => {
      const dl = await axios.get(
        `https://www.ytdlp.workers.dev/?url=ytsearch:${encodeURIComponent(query)}&audio_only=true`,
        { timeout: 45000 }
      )
      const url = dl.data?.url || dl.data?.audio_url
      if (!url) throw new Error('no audio')
      
      return {
        url,
        title: dl.data?.title || query,
        thumbnail: dl.data?.thumbnail || null
      }
    }
  ]

  // Run strategies
  for (const fn of strategies) {
    try {
      const res = await fn()
      if (res?.url?.startsWith('http')) {
        audioUrl = res.url
        title = res.title || query
        thumbnail = res.thumbnail
        break
      }
    } catch (_) {}
  }

  if (!audioUrl) {
    await conn.sendMessage(from, {
      text: `╔══════════════════╗
║  ❌ *NOT FOUND*
╠══════════════════╣
║ 🎵 ${query}
║ ⚠️ No results found
╚══════════════════╝`,
      edit: loading.key
    })
    return
  }

  // Downloading message
  await conn.sendMessage(from, {
    text: `╔══════════════════╗
║  ⬇️ *DOWNLOADING...*
╠══════════════════╣
║ 🎵 ${title.slice(0, 30)}
║ ⏳ Fetching audio...
╚══════════════════╝`,
    edit: loading.key
  })

  try {
    // Download audio
    const audioBuffer = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const buffer = Buffer.from(audioBuffer.data)

    if (buffer.length < 10000) throw new Error('File too small')

    // Delete loading message
    await conn.sendMessage(from, { delete: loading.key })

    // Send audio with thumbnail if available
    await conn.sendMessage(from, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${title.slice(0, 50).replace(/[^\w\s]/g, '')}.mp3`
    }, { quoted: mek })

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } })

  } catch (e) {
    await conn.sendMessage(from, {
      text: `╔══════════════════╗
║  ❌ *DOWNLOAD FAILED*
╠══════════════════╣
║ 🎵 ${title.slice(0, 30)}
║ ⚠️ Try again later
╚══════════════════╝`,
      edit: loading.key
    })
  }
})
