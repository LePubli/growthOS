import assert from 'node:assert/strict';
import { isPublicIPv4, validatePublicWebsite } from '../lib/seo/inspectWebsite';

const blockedHosts = [
  'http://example.com', 'https://localhost', 'https://127.0.0.1',
  'https://10.0.0.3', 'https://192.168.0.10', 'https://[::1]',
  'https://example.com:8443', 'https://user:pass@example.com',
  'https://example.com@127.0.0.1', 'https://example.com.evil.localhost',
];
for (const url of blockedHosts) assert.throws(() => validatePublicWebsite(url), `Unsafe URL accepted: ${url}`);

for (const ip of ['10.0.0.1','127.0.0.1','172.16.1.1','192.168.1.1','169.254.169.254','100.100.100.100','192.0.2.5','198.51.100.1','203.0.113.1','224.0.0.5']) {
  assert.equal(isPublicIPv4(ip),false,`Unsafe IP accepted: ${ip}`);
}
assert.equal(isPublicIPv4('8.8.8.8'),true);
assert.equal(isPublicIPv4('1.1.1.1'),true);
assert.equal(validatePublicWebsite('example.fr').href, 'https://example.fr/');
assert.equal(validatePublicWebsite('https://www.example.fr/page').hostname, 'www.example.fr');
console.log('SEO URL/IP safety checks passed');
