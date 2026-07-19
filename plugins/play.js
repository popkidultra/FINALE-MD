const { cmd } = require('../command')
const axios = require('axios')

cmd({
  pattern: 'play',
  alias: ['song', 'music', 'audio', 'ytmp3'],
  desc: 'Search and download a song',
  category: 'download',
  react: '🎵'
}, async (conn, mek, m, { reply, args, from }) => {

  const query = args.join(' ').trim()
  if (!query) return reply('❌ Please provide a song name\nExample: .play Faded')

  await reply(`🔍 Searching for *${query}*...`)

  try {
    let videoUrl = query

    // If not a YouTube link, search first
    if (!query.includes('youtu')) {
      const search = await axios.get(
        `https://api.siputzx.my.id/api/s/ytsearch?query=${encodeURIComponent(query)}`,
        { timeout: 15000 }
      )
      const video = search.data?.data?.[0]
      if (!video?.url) throw new Error('No results')
      videoUrl = video.url
    }

    await reply('⬇️ Fetching audio...')

    // Use the official Prexzy API
    const dl = await axios.get(
      `https://prexzyapis.com/download/ytmp3?url=${encodeURIComponent(videoUrl)}`,
      { timeout: 60000 }
    )
    const data = dl.data
    if (!data.status || !data.download_url) throw new Error('Download failed')

    const { title, duration_string, thumbnail, uploader } = data.info || {}

    // Send thumbnail with info (simple plain text)
    if (thumbnail) {
      try {
        const thumbRes = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 10000 })
        const thumbBuffer = Buffer.from(thumbRes.data)
        if (thumbBuffer.length > 2000) {
          await conn.sendMessage(from, {
            image: thumbBuffer,
            caption: `🎵 *${title || query}*\n👤 ${uploader || 'Unknown'}  |  ⏱ ${duration_string || 'N/A'}`
          }, { quoted: mek })
        }
      } catch {}
    }

    // Download and send audio
    const audioRes = await axios.get(data.download_url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const audioBuffer = Buffer.from(audioRes.data)

    if (audioBuffer.length < 10000) throw new Error('File too small')

    await conn.sendMessage(from, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${(title || 'audio').replace(/[^\w\s]/g, '').slice(0, 40)}.mp3`
    }, { quoted: mek })

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } })

  } catch (e) {
    console.error(e)
    reply('❌ Failed to download. Try another song.')
  }
})
