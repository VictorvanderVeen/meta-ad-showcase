// Maakt de PocketBase-collectie aan waarin de showcase de beoordelingen bewaart.
//
//   node --env-file=../me-timer/.env.migratie.local scripts/pocketbase-setup.mjs
//
// Veilig om opnieuw te draaien: een bestaande collectie blijft staan.

const NAAM = 'adshowcase_beoordelingen';
const base = process.env.PB_URL;

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const { token } = await request('/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  body: JSON.stringify({ identity: process.env.PB_ADMIN_EMAIL, password: process.env.PB_ADMIN_PASSWORD }),
});
const auth = { Authorization: token };

const bestaand = await fetch(`${base}/api/collections/${NAAM}`, { headers: auth });
if (bestaand.ok) {
  console.log(`${NAAM}: bestaat al (id ${(await bestaand.json()).id})`);
} else {
  const collectie = await request('/api/collections', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: NAAM,
      type: 'base',
      // De klant beoordeelt zonder inlog, via de link: lezen, aanmaken en
      // bijwerken zijn dus open. Verwijderen kan alleen de beheerder.
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: null,
      fields: [
        { name: 'klant', type: 'text', required: true, max: 60 },
        { name: 'item_id', type: 'text', required: true, max: 200 },
        { name: 'soort', type: 'text', max: 100 },
        { name: 'naam', type: 'text', max: 3000 },
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'approved', 'rejected'] },
        { name: 'opmerking', type: 'text', max: 3000 },
        { name: 'bijgewerkt', type: 'text', max: 40 },
      ],
      indexes: [`CREATE INDEX idx_adshowcase_klant ON ${NAAM} (klant)`],
    }),
  });
  console.log(`${NAAM}: aangemaakt (id ${collectie.id})`);
}
