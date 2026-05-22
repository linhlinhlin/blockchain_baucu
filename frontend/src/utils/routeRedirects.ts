export function appendSearchAndHash(to: string, search = '', hash = '') {
  const normalizedSearch = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  const normalizedHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';

  if (!normalizedSearch) {
    return `${to}${normalizedHash}`;
  }

  const joiner = to.includes('?') ? '&' : '?';
  return `${to}${joiner}${normalizedSearch.slice(1)}${normalizedHash}`;
}
