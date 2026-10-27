/// <reference path="../pb_data/types.d.ts" />
// Servertijd per beoordeling. "bijgewerkt" komt van de klok van de klant; voor meldingen
// willen we weten wanneer iets écht binnenkwam.
migrate((app) => {
  const c = app.findCollectionByNameOrId("adshowcase_beoordelingen");
  c.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("adshowcase_beoordelingen");
  c.fields.removeByName("updated");
  app.save(c);
});
