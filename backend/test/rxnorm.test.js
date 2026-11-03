const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRxNormResults,
  searchRxNorm,
  validateRxNormQuery,
} = require('../services/rxnorm');

test('RxNorm search queries are trimmed and bounded', () => {
  assert.equal(validateRxNormQuery('  aspirin  '), 'aspirin');
  assert.equal(validateRxNormQuery('a'), null);
  assert.equal(validateRxNormQuery('x'.repeat(101)), null);
  assert.equal(validateRxNormQuery(['aspirin']), null);
});

test('RxNorm results include unique supported drug concepts only', () => {
  const results = normalizeRxNormResults({
    drugGroup: {
      conceptGroup: [
        {
          tty: 'IN',
          conceptProperties: [{ rxcui: '1191', name: 'aspirin' }],
        },
        {
          tty: 'SCD',
          conceptProperties: [
            { rxcui: '1191', name: 'aspirin 325 MG Oral Tablet', synonym: 'aspirin 325 mg' },
            { rxcui: '1191', name: 'duplicate concept' },
            { rxcui: '2', name: 'suppressed concept', suppress: 'Y' },
            { rxcui: 'not-an-id', name: 'invalid concept' },
          ],
        },
        {
          tty: 'SBD',
          conceptProperties: [{ rxcui: '1234', name: 'Aspirin Brand Tablet' }],
        },
      ],
    },
  });

  assert.deepEqual(results, [
    {
      rxcui: '1191',
      name: 'aspirin 325 MG Oral Tablet',
      synonym: 'aspirin 325 mg',
      tty: 'SCD',
    },
    { rxcui: '1234', name: 'Aspirin Brand Tablet', synonym: '', tty: 'SBD' },
  ]);
  assert.deepEqual(normalizeRxNormResults({}), []);
});

test('RxNorm result count is capped', () => {
  const conceptProperties = Array.from({ length: 15 }, (_, index) => ({
    rxcui: String(index + 1),
    name: `Drug ${index + 1}`,
  }));
  const results = normalizeRxNormResults({
    drugGroup: { conceptGroup: [{ tty: 'SCD', conceptProperties }] },
  });

  assert.equal(results.length, 10);
});

test('RxNorm search ranks direct generic matches above combination products', () => {
  const results = normalizeRxNormResults(
    {
      drugGroup: {
        conceptGroup: [
          {
            tty: 'SBD',
            conceptProperties: [
              { rxcui: '1', name: '24 HR metformin / saxagliptin Oral Tablet [Brand]' },
            ],
          },
          {
            tty: 'SCD',
            conceptProperties: [
              { rxcui: '2', name: 'metformin hydrochloride 500 MG Oral Tablet' },
            ],
          },
        ],
      },
    },
    'metformin',
  );

  assert.equal(results[0].rxcui, '2');
});

test('RxNorm lookup calls the public API with encoded search text', async () => {
  let requestedUrl;
  const results = await searchRxNorm('aspirin 325 mg', async (url, options) => {
    requestedUrl = new URL(url);
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
    return {
      ok: true,
      json: async () => ({
        drugGroup: {
          conceptGroup: [
            {
              tty: 'SCD',
              conceptProperties: [{ rxcui: '1191', name: 'aspirin 325 MG Oral Tablet' }],
            },
          ],
        },
      }),
    };
  });

  assert.equal(requestedUrl.pathname, '/REST/drugs.json');
  assert.equal(requestedUrl.searchParams.get('name'), 'aspirin 325 mg');
  assert.equal(results[0].rxcui, '1191');
});

test('RxNorm lookup reports upstream HTTP errors', async () => {
  await assert.rejects(
    searchRxNorm('aspirin', async () => ({ ok: false, status: 503 })),
    /RxNorm returned HTTP 503/,
  );
});
