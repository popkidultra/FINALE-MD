const fs = require('fs')
const path = require('path')

const DB_DIR = path.join(__dirname, 'store')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

function filePath(name) {
  return path.join(DB_DIR, `${name}.json`)
}

function readJSON(name, fallback) {
  try {
    const p = filePath(name)
    if (!fs.existsSync(p)) return fallback
    const raw = fs.readFileSync(p, 'utf-8')
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    console.error(`[db] failed to read ${name}:`, e.message)
    return fallback
  }
}

let writeQueue = Promise.resolve()
function writeJSON(name, data) {
  // serialize writes per-process so concurrent saves don't corrupt the file
  writeQueue = writeQueue.then(() => {
    try {
      fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2))
    } catch (e) {
      console.error(`[db] failed to write ${name}:`, e.message)
    }
  })
  return writeQueue
}

module.exports = { readJSON, writeJSON }
