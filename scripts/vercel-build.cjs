const { spawnSync } = require('node:child_process');

function run(script, args) {
  const result = spawnSync(process.execPath, [require.resolve(script), ...args], {
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('prisma', ['generate']);
run('@nestjs/cli/bin/nest.js', ['build']);

// Apply schema changes only on production deploys. Preview builds stay isolated.
if (process.env.VERCEL_ENV === 'production') {
  run('prisma', ['migrate', 'deploy']);
}
