const net = require('net');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Utils = require('./src/utils.js');
const DBManager = require('./src/db.js');
const manager = new DBManager();
let sockets = [];
let cache = {};
let salt = 'aT6ivi1S';

const server = net.createServer(socket => {
    let chunk = Buffer.alloc(0);
    sockets.push({ socket });
    server.getConnections((err, count) => {
        if (err) {
            throw err;
        }
        console.log('connections :' + count);
    });
    socket.on('data', async (data) => {
        chunk = Buffer.concat([chunk, data]);
        let payload = Utils.decode(chunk);
        if (payload) {
            console.log(payload);
            await onRequest(socket, payload);
            chunk = Buffer.alloc(0);
        }
    });
    socket.on('end', () => {
        console.log('socket closed.');
    });
    socket.on('error', () => {
        console.log('socket has some error.');
    })
});

server.listen(process.env.PORT, '127.0.0.1', () => {
    console.log(`server start listening ${process.env.PORT}`, server.address());
    process.send('ready');
});

server.on('error', () => {
    console.log('some error.');
});
// 直到所有的连接结束才会触发这个事件
server.on('close', () => {
    console.log('server closed.')
});

async function onRequest(socket, payload) {
    let cmd = payload.cmd;
    switch (cmd) {
        case 'login':
            let package = {};
            let hash = crypto.createHash('md5');
            hash.update(payload.password + '&' + salt);
            let password = hash.digest('hex');
            // 注册信息
            let result = await manager.query('SELECT uid FROM register WHERE uid = ? AND `password` = ?;', [payload.uid, password]);
            console.log(result);
            if (!result || !result[0]) {
                socket.write(Utils.encode({ cmd, code: 10401, message: 'login failed', package }));
                return;
            }
            // 个人信息
            let userinfo = await manager.query('SELECT uid, nickname, signature, filepath, `status` FROM userinfo WHERE uid = ?;', [payload.uid]);
            console.log(userinfo);
            if (userinfo && userinfo[0]) {
                package = Object.assign(userinfo[0]);
            }
            // 好友
            let friends = await manager.query('SELECT * FROM userinfo WHERE uid IN (SELECT fid as fid from friends WHERE uid = ? UNION ALL SELECT uid as fid from friends WHERE fid = ?);', [payload.uid, payload.uid]);
            console.log(friends);
            // 最后一条聊天信息
            let chats = await manager.query('SELECT * FROM friends WHERE uid = ? OR fid = ?;', [payload.uid, payload.uid]);
            friends.forEach(info => {
                let data = chats.find(data => data.uid === info.uid || data.fid === info.uid);
                info.message = data.chat;
            });
            package.friends = friends;
            bindSocket(socket, payload.uid);
            socket.write(Utils.encode({ cmd, code: 10000, message: 'login success', package }));
            // 缓存数据发送
            sendCacheMessage(socket, payload.uid);
            break;
        case 'logout':
            unbindSocket(payload.uid);
            socket.end(Utils.encode({ cmd, message: 'server will close the socket' }));
            break;
        case 'chat_history':
            let histories = await manager.query('SELECT * FROM history WHERE `from` in (?) and `to` in (?) ORDER BY createtime LIMIT ?, 10;', [
                [payload.uid, payload.fid],
                [payload.uid, payload.fid], 0
            ]);
            socket.write(Utils.encode({ cmd, histories }));
            break;
        case 'chat':
            let insertResult = await manager.query('INSERT INTO history (`from`,`to`,chat) VALUES (?,?,?);', [payload.from, payload.to, payload.message]);
            console.log(insertResult);
            sendMessage(payload);
            break;
        case 'download':
            let filePath = path.resolve(__dirname, 'images/profiles', payload.filepath);
            let buffer = fs.readFileSync(filePath);
            socket.write(Utils.encode({ cmd, uid: payload.uid, filepath: payload.filepath }, buffer));
            break;
        case 'save_userinfo':
            console.log(payload.filename);
            fs.writeFile(path.resolve(__dirname, 'images/profiles', payload.filename), payload.buffer, err => {
                if (err) {
                    console.log(err);
                } else {
                    console.log('file saved!')
                }
            });
            let updateResult = await manager.query('update userinfo set filepath = ? where uid = ?', [payload.filename, payload.uid]);
            console.log(updateResult);
            break;
        default:
            socket.write(Utils.encode({ cmd, message: 'error message' }));
            break;
    }
}

function bindSocket(socket, uid) {
    let target = sockets.find(item => item.socket === socket);
    target.uid = uid;
    console.log('bindSocket: ', uid);
}

function unbindSocket(uid) {
    let index = sockets.findIndex(socket => socket.uid === uid);
    sockets.splice(index, 1);
    console.log('unbindSocket: ', uid);
}
/**
 * 发送消息
 * @param {Object} payload { cmd, from, to, message }
 */
function sendMessage(payload) {
    let target = sockets.find(item => item.uid === payload.to);
    if (target) {
        target.socket.write(Utils.encode(payload));
        console.log('sendMessage', payload);
    } else {
        let key = `${payload.from}_${payload.to}`;
        if (!cache[key]) {
            cache[key] = [];
        }
        cache[key].push(payload);
        console.log('sendMessage  cached', payload);
    }
}

/**
 * 发送离线消息
 * @param {net.Socket} socket
 * @param {String} uid 用户id
 */
function sendCacheMessage(socket, uid) {
    Object.keys(cache).forEach(key => {
        if (cache[key] && key.endsWith(uid)) {
            cache[key].forEach(data => {
                socket.write(Utils.encode(data));
                console.log('sendCacheMessage', data);
            });
            cache[key] = null;
        }
    });
}
