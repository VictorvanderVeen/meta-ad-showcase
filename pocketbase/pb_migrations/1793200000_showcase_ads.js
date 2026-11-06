/// <reference path="../pb_data/types.d.ts" />
// De ads zelf in PocketBase, zodat een tekst of beeld aanpassen meteen live is (zie
// docs/plan-ads-naar-pocketbase.md). Drie collecties:
//
//   adshowcase_klanten    één per klant (slug = de link, naam, taal)
//   adshowcase_campagnes  één per link; lege slug = de losse set direct onder de klant
//   adshowcase_ads        één per advertentie; item_id = de id waar de beoordelingen aan hangen
//
// Klanten bekijken zonder inlog, dus lezen is openbaar. Schrijven kan alleen de superuser.
// Een campagne met actief = uit is een concept: onzichtbaar voor klanten, zichtbaar voor jou.
migrate((app) => {
  const TALEN = ["nl", "en", "de", "sv"];

  const klanten = new Collection({
    type: "base",
    name: "adshowcase_klanten",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "slug", type: "text", required: true, max: 60, pattern: "^[a-z0-9-]+$" },
      { name: "naam", type: "text", required: true, max: 200 },
      { name: "taal", type: "select", maxSelect: 1, values: TALEN },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_adshowcase_klanten_slug ON adshowcase_klanten (slug)"],
  });
  app.save(klanten);

  const campagnes = new Collection({
    type: "base",
    name: "adshowcase_campagnes",
    listRule: "actief = true",
    viewRule: "actief = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "klant", type: "relation", required: true, collectionId: klanten.id, maxSelect: 1, cascadeDelete: false },
      // Leeg = de losse set op de klantlink zelf (de vorm van vóór de campagnes)
      { name: "slug", type: "text", max: 60, pattern: "^[a-z0-9-]*$" },
      { name: "naam", type: "text", max: 200 },
      { name: "actief", type: "bool" },
      { name: "in_lijst", type: "bool" },
      { name: "bijgewerkt", type: "date" },
      { name: "taal", type: "select", maxSelect: 1, values: TALEN },
      // De Facebook-kaart: zonder pagina_naam toont de showcase de ads als losse beelden
      { name: "pagina_naam", type: "text", max: 200 },
      { name: "kleur", type: "text", max: 20 },
      { name: "domein", type: "text", max: 200 },
      { name: "cta", type: "text", max: 60 },
      { name: "avatar", type: "file", maxSelect: 1, maxSize: 5242880, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
      { name: "primaire_teksten", type: "json", maxSize: 200000 },
      { name: "koppen", type: "json", maxSize: 200000 },
      { name: "beschrijvingen", type: "json", maxSize: 200000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_adshowcase_campagnes_klant_slug ON adshowcase_campagnes (klant, slug)"],
  });
  app.save(campagnes);

  const ads = new Collection({
    type: "base",
    name: "adshowcase_ads",
    listRule: "campagne.actief = true",
    viewRule: "campagne.actief = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "campagne", type: "relation", required: true, collectionId: campagnes.id, maxSelect: 1, cascadeDelete: true },
      // Nooit wijzigen: de beoordelingen van de klant hangen aan deze id
      { name: "item_id", type: "text", required: true, max: 200 },
      { name: "volgorde", type: "number", onlyInt: true },
      { name: "naam", type: "text", max: 3000 },
      { name: "formaat", type: "text", max: 40 },
      { name: "merk", type: "text", max: 200 },
      { name: "beeld", type: "file", required: true, maxSelect: 1, maxSize: 52428800,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"] },
      // Eigen teksten van deze ad; leeg = de gekozen variant uit de campagne
      { name: "primaire_tekst", type: "text", max: 10000 },
      { name: "kop", type: "text", max: 500 },
      { name: "beschrijving", type: "text", max: 1000 },
      { name: "cta", type: "text", max: 60 },
      // Hash van het bronbestand: het importscript uploadt een beeld alleen opnieuw als het veranderd is
      { name: "bron_hash", type: "text", max: 64, hidden: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_adshowcase_ads_item_id ON adshowcase_ads (item_id)",
      "CREATE INDEX idx_adshowcase_ads_campagne ON adshowcase_ads (campagne)",
    ],
  });
  app.save(ads);
}, (app) => {
  for (const naam of ["adshowcase_ads", "adshowcase_campagnes", "adshowcase_klanten"]) {
    app.delete(app.findCollectionByNameOrId(naam));
  }
});
