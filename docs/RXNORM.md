# RxNorm medicine reference lookup

The medicine-entry form can search the U.S. National Library of Medicine's
RxNorm API for generic and branded clinical drug names. Selecting a result
fills the medicine name and records its RxCUI and RxNorm term type. Staff must
still enter the local batch number, quantity, expiry date, and prices.

New products appear in the medicine list in case-insensitive alphabetical
order. A different batch or expiry is stored as a separate lot for traceability;
adding the same product, batch, and expiry again increases the existing lot's
stock instead of creating a duplicate.

RxNorm is U.S.-focused reference terminology. A match does **not** confirm
Kenyan Pharmacy and Poisons Board registration, local market availability,
authenticity, or suitability for a patient. The search is optional; staff can
enter a medicine manually if RxNorm has no match or its API is unavailable.

The lookup uses the public RxNav REST API from the backend. The backend
requires an authenticated session, limits query length and result count, and
times out the upstream request. No API key or additional package is required.

## NLM attribution

This product uses publicly available data courtesy of the U.S. National
Library of Medicine (NLM), National Institutes of Health, Department of Health
and Human Services; NLM is not responsible for the product and does not
endorse or recommend this or any other product.

See the [RxNorm Terms of Service](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html)
for current attribution and use terms.
