// PM2 Ecosystem Configuration
// For production deployment with PM2 process manager

module.exports = {
  apps: [
    {
      name: 'conversa-clone',
      script: './src/server.js',
      
      // Instances
      instances: 2, // Use 'max' to use all CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced features
      watch: false, // Set to true for development
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads',
        'whatsapp-sessions',
        '.git'
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: false
      },
      
      // Restart behavior
      max_memory_restart: '500M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      
      // Graceful shutdown
      wait_ready: true,
      shutdown_with_message: true,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Source map support
      source_map_support: true,
      
      // Interpreter
      interpreter: 'node',
      interpreter_args: '--max-old-space-size=4096',
      
      // Instance variables
      instance_var: 'INSTANCE_ID',
      
      // Cluster mode specific
      increment_var: 'PORT',
      
      // Monitoring
      vizion: true,
      post_update: ['npm install'],
      
      // Error handling
      pmx: true,
      automation: false,
      
      // Custom metrics
      metrics: {
        http: true,
        v8: true,
        eventLoop: true,
        network: true
      }
    },
    
    // Message Queue Worker (optional separate process)
    {
      name: 'conversa-queue-worker',
      script: './src/workers/queueWorker.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'queue'
      },
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'queue'
      },
      
      error_file: './logs/queue-worker-error.log',
      out_file: './logs/queue-worker-out.log',
      
      autorestart: true,
      max_memory_restart: '300M',
      watch: false
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/BaiseBaise886/conversa-clone.git',
      path: '/var/www/conversa-clone',
      ssh_options: 'StrictHostKeyChecking=no',
      
      'pre-deploy': 'git fetch --all',
      'post-deploy': 'npm install && npm run migrate && pm2 reload ecosystem.config.js --env production',
      
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'https://github.com/BaiseBaise886/conversa-clone.git',
      path: '/var/www/conversa-clone-staging',
      ssh_options: 'StrictHostKeyChecking=no',
      
      'post-deploy': 'npm install && npm run migrate && pm2 reload ecosystem.config.js --env staging',
      
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};