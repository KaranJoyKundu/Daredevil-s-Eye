import { readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)\.(\d+))?$/.exec(pkg.version);
if (!match) throw new Error(`Unsupported SemVer version: ${pkg.version}`);
const [, majorText, minorText, patchText, channel, sequenceText] = match;
const major = Number(majorText), minor = Number(minorText), patch = Number(patchText);
const sequence = sequenceText ? Number(sequenceText) : 99;
if (major > 999 || minor > 99 || patch > 99 || sequence < 1 || sequence > 99) {
  throw new Error('Version is outside the supported Android versionCode range.');
}
const channelOffset = channel ? ({ alpha: 0, beta: 0, rc: 0 }[channel.toLowerCase()] ?? null) : 0;
if (channel && channelOffset === null) throw new Error(`Unsupported prerelease channel: ${channel}`);
const versionCode = major * 1_000_000 + minor * 10_000 + patch * 100 + sequence;
const gradlePath = new URL('../android/app/build.gradle', import.meta.url);
let gradle = await readFile(gradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+["'][^"']+["']/.test(gradle)) {
  throw new Error('Could not find versionCode/versionName in android/app/build.gradle');
}
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+["'][^"']+["']/, `versionName "${pkg.version}"`);
await writeFile(gradlePath, gradle);
console.log(`Android versionName=${pkg.version} versionCode=${versionCode}`);
