module.exports = {
  apps: [{
    name: 'transaction-worker',
    script: 'src/queue/transaction.queue.ts',
    interpreter: 'ts-node',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}

