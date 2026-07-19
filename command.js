const commands = []

/**
 * Register a command.
 * @param {Object} info
 * @param {string} info.pattern - main command name (without prefix)
 * @param {string[]} [info.alias] - alternate names
 * @param {string} [info.desc] - short description shown in menu
 * @param {string} [info.category] - menu category
 * @param {string} [info.react] - emoji to react with when the command fires
 * @param {boolean} [info.ownerOnly] - restrict to bot owner
 * @param {boolean} [info.groupOnly] - restrict to group chats
 * @param {boolean} [info.adminOnly] - restrict to group admins
 * @param {Function} func - handler: (conn, mek, m, context) => void
 */
function cmd(info, func) {
  const data = { ...info, function: func }
  commands.push(data)
  return data
}

module.exports = { commands, cmd }
