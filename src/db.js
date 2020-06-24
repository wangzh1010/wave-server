const mysql = require('mysql')
let config = {
    connectionLimit: 10,
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'ii12369',
    database: 'im'
};

const pool = mysql.createPool(config);

pool.on('acquire', (connection) => {
    console.log('connection %d acquird', connection.threadId);
});

pool.on('enqueue', () => {
    console.log('Waiting for available connection slot');
});

pool.on('release', (connection) => {
    console.log('Connection %d released', connection.threadId);
});

pool.on('connection', () => {
    console.log('connected');
});

class DBManager {
    query(sql, args = null) {
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    return reject(err);
                }
                connection.query(sql, args, (err, results, fields) => {
                    connection.release();
                    if (err) {
                        return reject(err);
                    }
                    resolve(results);
                });
            });
        });
    }
}

module.exports = DBManager;
