// Minimal CKAN (data.gov.il) datastore client.
// The portal exposes every resource as a live SQL-ish "datastore". We page
// through datastore_search with limit+offset until we've pulled `total` rows.
const BASE = "https://data.gov.il/api/3/action";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "election-maps-mvp/0.1 (ynet demo)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error("CKAN success=false");
    return body.result;
  } catch (err) {
    if (attempt < 4) {
      await sleep(800 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    throw new Error(`CKAN fetch failed for ${url}: ${err.message}`);
  }
}

/** Fetch every record of a resource, paging through the datastore. */
export async function fetchAll(resourceId, { pageSize = 1000 } = {}) {
  const records = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url = `${BASE}/datastore_search?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}`;
    const result = await getJson(url);
    total = result.total;
    records.push(...result.records);
    if (result.records.length === 0) break;
    offset += result.records.length;
  }
  return records;
}

/** Field metadata (column ids in order) for a resource. */
export async function fetchFields(resourceId) {
  const result = await getJson(`${BASE}/datastore_search?resource_id=${resourceId}&limit=0`);
  return result.fields.map((f) => f.id);
}
