'use strict'
const chalk = require('chalk')

function timestamp() {
  return new Date().toTimeString().split(' ')[0]
}

module.exports = {
  info(...args) {
    console.log(chalk.gray(`[${timestamp()}]`), ...args)
  },
  warn(...args) {
    console.warn(chalk.gray(`[${timestamp()}]`), ...args)
  },
  error(...args) {
    console.error(chalk.gray(`[${timestamp()}]`), ...args)
  },
  debug(...args) {
    if (process.env.DEBUG) console.debug(chalk.gray(`[${timestamp()}]`), ...args)
  }
}
