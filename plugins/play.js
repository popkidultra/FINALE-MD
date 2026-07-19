const { cmd } = require('../command')
const { runtime } = require('../lib/functions')
const config = require('../config')
const axios = require('axios')

/**
 * Validates if a string is a valid YouTube URL
 */
function isYtUrl(url) {
  return /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([A-Za-z0-9_-]{11})/.test(url);
}

/**
 * Extracts the 11-character Video ID from a YouTube URL
 */
function extractYtId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Standardized layout formatter for bot text responses
 */
const fmt = (commandName, lines) => {
  return `╭─❏ 「 ${commandName} 」\n` + 
         lines.map(line => `│ ${line}`).join("\n") + 
         `\n╰───────\n> *${config.BOT_NAME}*`;
};

/**
 * Tries multiple public APIs sequentially to resolve a YouTube audio download link
 */
async function resolveAudio(query, isUrlMatched) {
  const encodedQuery = encodeURIComponent(query);
  
  const primaryApis = isUrlMatched ? [
    async () => {
      const response = await axios.get(`https://api.sidycoders.rs.xyz/api/ytmp3?url=${encodedQuery}&apikey=mikey`, { timeout: 35000 });
      if (!response.data?.status || !response.data?.cdn) throw new Error();
      return { url: response.data.cdn, title: response.data.title || 'Audio File' };
    },
    async () => {
      const videoId = extractYtId(query);
      if (!videoId) throw new Error();
      const response = await axios.get(`https://api.vkrish.xyz/downloader/ytmp3?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`, { timeout: 35000 });
      if (!response.data?.status || !response.data?.result?.url) throw new Error();
      return { url: response.data.result.url, title: response.data.result.title || 'Audio File' };
    }
  ] : [
    async () => {
      const response = await axios.get(`https://api.siputzx.my.id/api/ytplay?query=${encodedQuery}`, { timeout: 35000 });
      if (!response.data?.status || !response.data?.result?.downloadUrl) throw new Error();
      return {
        url: response.data.result.downloadUrl,
        title: response.data.result.title || query,
        thumbnail: response.data.result.thumbnail || '',
        sourceUrl: response.data.result.sourceUrl || ''
      };
    },
    async () => {
      const response = await axios.get(`https://api.sidycoders.rs.xyz/api/ytplay?q=${encodedQuery}&apikey=mikey`, { timeout: 35000 });
      if (!response.data?.status || !response.data?.cdn) throw new Error();
      return { url: response.data.cdn, title: response.data.title || query };
    }
  ];

  const fallbackEndpoints = [
    `https://api.agatz.xyz/api/ytmp3?url=${encodedQuery}`,
    `https://api.vkrish.xyz/downloader/ytmp3?url=${encodedQuery}`,
    `https://api.siputzx.my.id/api/ytmp3?url=${encodedQuery}`,
    `https://api.tess.o9ee.xyz/api/ytmp3?url=${encodedQuery}`
  ].map(endpointUrl => async () => {
    const response = await axios.get(endpointUrl, { timeout: 35000 });
    const directUrl = response.data?.result || response.data?.url || response.data?.result?.url || response.data?.downloadUrl;
    if (!directUrl || typeof directUrl !== 'string' || !directUrl.startsWith('http')) throw new Error();
    return { url: directUrl, title: response.data?.title || response.data?.result?.title || query };
  });

  for (const apiCall of [...primaryApis, ...fallbackEndpoints]) {
    try { return await apiCall(); } catch (e) {}
  }
  return null;
}

// ==========================================
// COMMAND: play
// ==========================================
cmd({
  pattern: 'play',
  alias: ['audio', 'song', 'music'],
  desc: 'Download and play audio from YouTube',
  category: 'download',
  react: '🎶'
}, async (conn, mek, m, { reply, q }) => { // <--- Added 'q' here to receive the input query string directly
  try {
    if (!q || !q.trim()) {
      return reply(fmt('PLAY', [
        "Please provide a search term or link.",
        `Example: ${config.PREFIX}play cardigan`,
        `Link: ${config.PREFIX}play https://youtube.com/...`
      ]));
    }

    const cleanQuery = q.trim();
    const isUrl = isYtUrl(cleanQuery);

    await reply(fmt('PLAY', ["Searching for audio... Please wait."]));

    const audioData = await resolveAudio(cleanQuery, isUrl);
    if (!audioData) {
      return reply(fmt('ERROR', [
        `No results found for "${cleanQuery}"`,
        "The download servers might be down. Try a different title."
      ]));
    }

    const { url: downloadUrl, title: audioTitle, thumbnail: thumbUrl, sourceUrl } = audioData;
    const safeFileName = (audioTitle || cleanQuery).replace(/[^\w\s.-]/g, '') + '.mp3';

    // 1. Send Audio File wrapper (Plays directly inside the chat)
    await conn.sendMessage(m.chat, {
      audio: { url: downloadUrl },
      mimetype: 'audio/mp4',
      ptt: false,
      fileName: safeFileName,
      contextInfo: thumbUrl ? {
        externalAdReply: {
          title: (audioTitle || cleanQuery).substring(0, 40),
          body: config.BOT_NAME,
          thumbnailUrl: thumbUrl,
          sourceUrl: sourceUrl || downloadUrl,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      } : undefined
    }, { quoted: mek });

    // 2. Send Document File wrapper (Forces raw file download)
    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: 'audio/mpeg',
      fileName: (audioTitle || cleanQuery).replace(/[<>:"/\\|?*]/g, '_') + '.mp3',
      caption: fmt('PLAY', [`Downloaded: ${audioTitle || cleanQuery}`])
    }, { quoted: mek });

  } catch (error) {
    return reply(fmt('ERROR', [`Failed to process request: ${error.message}`]));
  }
})
