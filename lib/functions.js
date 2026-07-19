const axios = require('axios')

function getBuffer(url, options = {}) {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url,
      headers: { 'DNT': 1, 'Upgrade-Insecure-Requests': 1 },
      responseType: 'arraybuffer',
      ...options
    })
      .then(res => resolve(res.data))
      .catch(err => reject(err))
  })
}

async function fetchJson(url, options = {}) {
  try {
    const res = await axios({ method: 'get', url, ...options })
    return res.data
  } catch (e) {
    return e
  }
}

function getGroupAdmins(participants) {
  const admins = []
  for (const p of participants || []) {
    if (p.admin === 'superadmin' || p.admin === 'admin') admins.push(p.id)
  }
  return admins
}

function getRandom(ext = '') {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}${ext}`
}

function h2k(hex) {
  return Buffer.from(hex, 'hex')
}

function isUrl(text = '') {
  return /https?:\/\/[^\s]+/g.test(text)
}

function Json(obj) {
  return JSON.stringify(obj, null, 2)
}

function runtime(seconds) {
  seconds = Math.floor(seconds)
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return (d ? `${d}d ` : '') + (h ? `${h}h ` : '') + (m ? `${m}m ` : '') + `${s}s`
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson }
