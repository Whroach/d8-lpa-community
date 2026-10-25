/**
 * Shared guard rails for the one-off maintenance scripts in server/src.
 *
 * These scripts used to carry a production connection string (and, in some
 * cases, an admin password) as a hard-coded fallback, so running one without
 * a .env quietly pointed it at the live database. Nothing is hard-coded any
 * more: every script must be told which database to use, and the ones that
 * wipe data refuse anything that is not a local database unless the caller
 * spells out that they really mean it.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalMongoUri(uri) {
  try {
    if (!uri || uri.startsWith('mongodb+srv://')) return false;
    const withoutScheme = uri.replace(/^mongodb:\/\//, '');
    const hostList = withoutScheme.split('/')[0].split('@').pop();
    return hostList
      .split(',')
      .every((entry) => LOCAL_HOSTS.has(entry.replace(/:\d+$/, '')));
  } catch {
    return false;
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set. Pass it in the environment, for example:`);
    console.error(`  $env:${name} = '...'; node ${process.argv[1]}\n`);
    process.exit(1);
  }
  return value;
}

/**
 * @param {{ destructive?: boolean }} [options] destructive scripts (seed,
 *   clear) only run against a local database unless ALLOW_REMOTE_DB_WIPE=yes.
 */
export function requireMongoUri(options = {}) {
  const uri = requireEnv('MONGODB_URI');
  if (
    options.destructive &&
    !isLocalMongoUri(uri) &&
    process.env.ALLOW_REMOTE_DB_WIPE !== 'yes'
  ) {
    console.error('\nRefusing to run: this script deletes data and MONGODB_URI is not a local database.');
    console.error('If you are completely sure, set ALLOW_REMOTE_DB_WIPE=yes and run it again.\n');
    process.exit(1);
  }
  return uri;
}
