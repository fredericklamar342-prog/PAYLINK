import { spawn } from 'node:child_process';
import { startFixture } from '../tests/support/supabase-fixture.mjs';

// Reuse the production build produced by npm test for before/after audits.
const fixture = await startFixture();
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], {
  stdio: 'inherit',
  env: {
    ...process.env, PAYLINK_TEST_BUILD: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3101',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test_fixture_only',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '', PAYLINK_STAGING_PROJECT_REF: '',
    SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '',
  },
});
function stop() { child.kill(); fixture.close(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', code => { fixture.close(); process.exit(code ?? 0); });
