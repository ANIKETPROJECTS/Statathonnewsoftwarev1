const path = require("path");

module.exports = {
  apps: [
    {
      name: "csv-profiler",
      script: path.join(__dirname, "artifacts/api-server/dist/index.mjs"),
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "3013",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: path.join(__dirname, "logs/pm2-error.log"),
      out_file: path.join(__dirname, "logs/pm2-out.log"),
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
