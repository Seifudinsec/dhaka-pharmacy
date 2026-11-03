const RXNORM_API = 'https://rxnav.nlm.nih.gov/REST';
const MAX_RESULTS = 10;

const validateRxNormQuery = (query) => {
  if (typeof query !== 'string') return null;
  const term = query.trim();
  return term.length >= 2 && term.length <= 100 ? term : null;
};

const normalizeRxNormResults = (payload, query = '') => {
  const groups = payload?.drugGroup?.conceptGroup;
  if (!Array.isArray(groups)) return [];

  const results = [];
  const seen = new Set();
  const searchText = query.trim().toLowerCase();
  const searchTokens = searchText.split(/\s+/).filter(Boolean);
  for (const group of groups) {
    if (!['SCD', 'SBD'].includes(group?.tty) || !Array.isArray(group.conceptProperties)) {
      continue;
    }

    for (const concept of group.conceptProperties) {
      const rxcui = String(concept?.rxcui || '');
      const name = String(concept?.name || '').trim();
      if (
        !rxcui ||
        !/^\d+$/.test(rxcui) ||
        !name ||
        concept.suppress === 'Y' ||
        seen.has(rxcui)
      ) {
        continue;
      }

      seen.add(rxcui);
      results.push({
        rxcui,
        name: name.slice(0, 200),
        synonym: String(concept.synonym || '').trim().slice(0, 200),
        tty: group.tty,
      });
    }
  }

  if (searchText) {
    const relevance = (result) => {
      const name = result.name.toLowerCase();
      const synonym = result.synonym.toLowerCase();
      const combined = `${name} ${synonym}`;
      const matches = searchTokens.filter((token) => combined.includes(token)).length;
      const namePosition = name.indexOf(searchText);
      const synonymPosition = synonym.indexOf(searchText);
      return (
        (matches / searchTokens.length) * 100 +
        (namePosition === 0 ? 40 : namePosition > 0 ? Math.max(0, 15 - namePosition) : 0) +
        (synonymPosition === 0
          ? 10
          : synonymPosition > 0
            ? Math.max(0, 5 - synonymPosition)
            : 0) -
        (name.match(/\//g) || []).length * 15
      );
    };

    results.sort((left, right) => {
      const relevanceDifference = relevance(right) - relevance(left);
      if (relevanceDifference) return relevanceDifference;
      if (left.tty !== right.tty) return left.tty === 'SCD' ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }
  return results.slice(0, MAX_RESULTS);
};

const searchRxNorm = async (term, fetchImpl = global.fetch) => {
  const url = new URL(`${RXNORM_API}/drugs.json`);
  url.searchParams.set('name', term);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`RxNorm returned HTTP ${response.status}`);
    }
    return normalizeRxNormResults(await response.json(), term);
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  normalizeRxNormResults,
  searchRxNorm,
  validateRxNormQuery,
};
