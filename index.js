const http = require('http');
const { DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const port = 3004;

// Función para realizar el reemplazo de variables en un mensaje
function buildMessageTemplate(template, values) {
    return template.replace(/{([^{}]*)}/g, (match, key) => {
        return values[key] || match;
    });
}

// Función para conectar a WhatsApp
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        version: [2, 2413, 1]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('opened connection');
        }
        
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async m => {
        if (m.messages[0].key.fromMe) return
        console.log(JSON.stringify(m, undefined, 2))

        console.log('replying to', m.messages[0].key.remoteJid)
        await sock.sendMessage('59169973651@c.us', { text: 'Hello there!' })
    })

    // Crear el servidor HTTP
    const server = http.createServer((req, res) => {
        if (req.url === '/send-message' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const reqData = JSON.parse(body);
                    let contactId;

                    if (reqData.contact_type === 'group') {
                        // es un grupo
                        contactId = reqData.contact_id + '@g.us';
                    } else if (reqData.contact_type === 'contact') {
                        // es un contacto
                        contactId = reqData.contact_id.replace(/\+/g, "") + '@s.whatsapp.net';
                    }

                    let messageOptions;
                    if (reqData.message_type === 'static') {
                        messageOptions = { text: reqData.message };
                    } else if (reqData.message_type === 'customized') {
                        const message = buildMessageTemplate(reqData.message_template, reqData);
                        messageOptions = { text: message };
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'error', message: 'Tipo de mensaje no válido' }));
                        return;
                    }

                    await sock.sendMessage(contactId, messageOptions);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', message: 'Mensaje enviado correctamente' }));
                } catch (error) {
                    console.error('Error procesando la solicitud:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Error procesando la solicitud' }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'URL no encontrada' }));
        }
    });

    server.listen(port, () => {
        console.log(`Servidor escuchando en http://localhost:${port}`);
    });
}

// Ejecutar la función de conexión a WhatsApp
connectToWhatsApp();