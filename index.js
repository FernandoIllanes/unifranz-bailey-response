const { DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state,
        version: [2, 2413, 1]
    })
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === 'open') {
            console.log('opened connection')
        }
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('messages.upsert', async m => {
        if (m.messages[0].key.fromMe) return
        console.log(JSON.stringify(m, undefined, 2))

        console.log('replying to', m.messages[0].key.remoteJid)
        await sock.sendMessage('m.messages[0].key.remoteJid', { text: 'Hello there!' })
    })
}
// run in main file
connectToWhatsApp()