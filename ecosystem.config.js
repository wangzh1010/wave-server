let config = {
    'win32': {
        cwd: './',
        ignore_watch: ['node_modules', 'logs', 'pids', 'images'],
        log: './logs/wave.log',
        pid_file: './pids/wave.pid',
        port: 8124
    },
    'linux': {
        cwd: '/data1/apps/wave/',
        ignore_watch: ['node_modules', 'backup'],
        output: '/data1/logs/wave/wave.out.log',
        error: '/data1/logs/wave/wave.error.log',
        pid_file: '/var/run/wave/wave.pid',
        port: 10096
    }
}
module.exports = {
    apps: [{
        name: 'wave',
        script: 'app.js',
        exec_mode: 'fork',
        instances: 1,
        merge_logs: true,
        kill_timeout: 1600,
        wait_ready: true,
        listen_timeout: 3000,
        autorestart: true,
        watch: true,
        watch_delay: 1000,
        restart_delay: 3000,
        max_memory_restart: '512M',
        exp_backoff_restart_delay: 100,
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        ...config[process.platform]
    }]
};
