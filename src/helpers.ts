// eslint-disable-next-line @typescript-eslint/no-var-requires
const mdns = require('mdns');

const mdnsSequence = [
  mdns.rst.DNSServiceResolve(),
  'DNSServiceGetAddrInfo' in mdns.dns_sd
    ? mdns.rst.DNSServiceGetAddrInfo()
    : mdns.rst.getaddrinfo({ families: [0] }),
  mdns.rst.makeAddressesUnique(),
];

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

export { mdnsSequence, getCircularReplacer };
