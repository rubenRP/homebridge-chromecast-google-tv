let mdns: typeof import('mdns') | undefined;

// Dynamically import mdns
const initMdns = async () => {
  if (!mdns) {
    mdns = await import('mdns');
  }
  return mdns;
};

const getMdnsSequence = async () => {
  const mdnsModule = await initMdns();
  return [
    mdnsModule.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdnsModule.dns_sd
      ? mdnsModule.rst.DNSServiceGetAddrInfo()
      : mdnsModule.rst.getaddrinfo({ families: [0] }),
    mdnsModule.rst.makeAddressesUnique(),
  ];
};

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

export { getCircularReplacer, getMdnsSequence, initMdns };
