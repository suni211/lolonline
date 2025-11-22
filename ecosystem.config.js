// PM2 설정 파일
module.exports = {
  apps: [
    {
      name: 'server',
      script: 'npm',
      args: 'start',
      cwd: '/home/ine158lovely/lolonline/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ine158lovely/.pm2/logs/server-error.log',
      out_file: '/home/ine158lovely/.pm2/logs/server-out.log'
    },
    {
      name: 'client',
      script: 'npm',
      args: 'run preview',
      cwd: '/home/ine158lovely/lolonline/client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ine158lovely/.pm2/logs/client-error.log',
      out_file: '/home/ine158lovely/.pm2/logs/client-out.log'
    }
  ]
};

