/// <reference path="../pb_data/types.d.ts" />
// Mailt Victor één samenvatting zodra een klant klaar is met beoordelen in de ad-showcase.
// Elke 5 minuten: per klant de beoordelingen sinds de vorige melding. Is het daarna 10 minuten
// stil, dan is de klant klaar en gaat er één mail uit (niet één per klik).
// Mailt via de TransIP-relay met de gegevens uit mail.env (zet dat met mailwachtwoord.sh)
// en leent tijdhulpjes uit afspraak_lib.js.

cronAdd("showcaseMelding", "*/5 * * * *", () => {
  const lib = require(`${__hooks}/afspraak_lib.js`);
  const STIL_MS = 10 * 60e3;
  const SHOWCASE = "https://victorvanderveen.github.io/meta-ad-showcase/";
  const STAND = __hooks + "/../showcase_melding.json"; // {start, klanten: {slug: laatst gemelde ms}}
  const MAAND = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const DAG = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const ms = (pbTijd) => new Date(pbTijd.replace(" ", "T")).getTime();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tijd = (t) => { const k = lib.naarAmsterdam(t); return lib.twee(k.uur) + ":" + lib.twee(k.minuut); };

  let stand;
  try { stand = JSON.parse(toString($os.readFile(STAND))); } catch (_) {
    // Eerste keer: alleen wat vanaf nu binnenkomt telt, oude beoordelingen niet
    $os.writeFile(STAND, JSON.stringify({ start: Date.now(), klanten: {} }), 420);
    return;
  }

  const recs = $app.findRecordsByFilter("adshowcase_beoordelingen", "updated > {:van}", "updated", 0, 0,
    { van: new Date(Date.now() - 7 * 864e5).toISOString().replace("T", " ") });
  const perKlant = {};
  recs.forEach((r) => {
    const k = r.getString("klant");
    const t = ms(r.getString("updated"));
    if (t > (stand.klanten[k] || stand.start)) (perKlant[k] = perKlant[k] || []).push({ r, t });
  });

  Object.keys(perKlant).forEach((klant) => {
    const nieuw = perKlant[klant];
    const eerste = nieuw[0].t;
    const laatste = nieuw[nieuw.length - 1].t;
    if (Date.now() - laatste < STIL_MS) return; // klant is nog bezig

    let naam = klant;
    try {
      const res = $http.send({ url: SHOWCASE + "ads/" + klant + "/campaigns.json", timeout: 10 });
      if (res.statusCode === 200 && res.json.client) naam = res.json.client;
    } catch (_) {}

    const tel = { approved: 0, rejected: 0, pending: 0 };
    let opmerkingen = 0;
    const regels = [];
    nieuw.forEach(({ r }) => {
      const status = r.getString("status");
      const opm = r.getString("opmerking").trim();
      tel[status] = (tel[status] || 0) + 1;
      if (opm) opmerkingen++;
      if (status === "rejected" || opm) {
        regels.push("<li>" + (status === "rejected" ? "✕" : status === "approved" ? "✓" : "•") + " <b>" + esc(r.getString("naam")) + "</b>" +
          (r.getString("soort") ? " <span style=\"color:#777\">(" + esc(r.getString("soort")) + ")</span>" : "") +
          (opm ? "<br><i>" + esc(opm) + "</i>" : "") + "</li>");
      }
    });

    const k = lib.naarAmsterdam(eerste);
    const wanneer = DAG[k.weekdag] + " " + k.dag + " " + MAAND[k.maand] + ", " + tijd(eerste) + (laatste - eerste > 60e3 ? "–" + tijd(laatste) : "");
    try {
      // TransIP laat de VPS alleen via hun relay mailen; afzender moet dus @vdveen.online zijn
      const env = {};
      toString($os.readFile(__hooks + "/../mail.env")).split("\n").forEach((r) => {
        const i = r.indexOf("=");
        if (i > 0 && r[0] !== "#") env[r.slice(0, i).trim()] = r.slice(i + 1).trim();
      });
      // SMTP alleen in het geheugen, net als de afspraak-tool: wachtwoord blijft uit de database
      const s = $app.settings();
      s.smtp.enabled = true;
      s.smtp.host = env.MAIL_HOST;
      s.smtp.port = parseInt(env.MAIL_PORT, 10);
      s.smtp.tls = false; // poort 587: STARTTLS
      s.smtp.username = env.MAIL_USER;
      s.smtp.password = env.MAIL_PASS;

      $app.newMailClient().send(new MailerMessage({
        from: { address: env.MAIL_FROM || "showcase@vdveen.online", name: "Ad-showcase" },
        replyTo: [{ address: lib.INSTELLINGEN.mail, name: lib.INSTELLINGEN.naam }],
        to: [{ address: lib.INSTELLINGEN.mail, name: lib.INSTELLINGEN.naam }],
        subject: naam + " heeft " + nieuw.length + " items beoordeeld (" + tel.approved + " ✓, " + tel.rejected + " ✕)",
        html:
          '<div style="font-family:Inter,Arial,sans-serif;color:#212121;max-width:560px">' +
          '<p style="font-size:22px;font-weight:900;margin:0 0 12px">' + esc(naam) + " heeft beoordeeld</p>" +
          "<p>" + wanneer + "<br>" + tel.approved + " goedgekeurd, " + tel.rejected + " afgekeurd" +
          (tel.pending ? ", " + tel.pending + " teruggezet naar open" : "") + ", " + opmerkingen + " met opmerking.</p>" +
          (regels.length ? "<p style=\"margin-bottom:4px\"><b>Afgekeurd of met opmerking:</b></p><ul style=\"padding-left:18px\">" + regels.slice(0, 80).join("") + "</ul>" : "") +
          '<p><a href="' + SHOWCASE + esc(klant) + '/" style="display:inline-block;background:#ef3713;color:#fff;font-weight:900;padding:12px 20px;border-radius:8px;text-decoration:none">Open de showcase</a></p></div>',
      }));
      stand.klanten[klant] = laatste;
      $os.writeFile(STAND, JSON.stringify(stand), 420);
    } catch (err) {
      $app.logger().error("showcase melding", "klant", klant, "fout", String(err));
    }
  });
});
