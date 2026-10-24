// club-copy.js — copie réduite du dossier pour le président de club (coffre).
// Le président n'a besoin que de l'identité du candidat, de ses choix de camp et du
// Commitment : l'AF est copié sans la pièce d'identité, la religion ni la section santé,
// et seuls cet AF réduit et le Commitment sont gardés. Généré dans le navigateur du candidat.
"use strict";
// n°, validité et lieu de délivrance de la pièce d'identité ; religion ;
// section III « Health, Medical, Dietary & Insurance » en entier
const CLUB_REDACT = ["X22", "G23", "X23", "J31",
  "K42", "S43", "AG43", "G44", "O44", "Z44", "AH44",
  "M45", "Q45", "X45", "M46", "Q46", "X46", "M47", "Q47", "X47", "M48", "Q48", "X48",
  "K49", "AB49", "K50", "AB50"];

function zipBase(n){ return n.split("/").pop(); }
function u8buf(u8){ return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }

// Vide les textes partagés que plus aucune cellule n'utilise : un AF rempli dans Excel range
// ses textes dans sharedStrings.xml, où ils resteraient lisibles après avoir vidé la cellule.
// Les index sont conservés (chaque <si> inutilisé devient vide).
function dropUnusedShared(sheetXml, sstXml){
  const used = {};
  sheetXml.replace(/<c\b[^>]*\bt="s"[^>]*>\s*<v>(\d+)<\/v>/g, function(m, i){ used[i] = 1; return m; });
  let i = -1;
  return sstXml.replace(/<si>[\s\S]*?<\/si>|<si\/>/g, function(si){ i++; return used[i] ? si : "<si><t></t></si>"; });
}

async function redactApplicationForm(afU8){
  const entries = await unzip(u8buf(afU8));
  const sheet = entries.find(function(e){ return e.name === "xl/worksheets/sheet1.xml"; });
  if(!sheet) throw new Error("the application form has no worksheet");
  let xml = new TextDecoder().decode(sheet.data);
  CLUB_REDACT.forEach(function(ref){ xml = setCell(xml, ref, ""); });
  sheet.data = new TextEncoder().encode(xml);
  const sst = entries.find(function(e){ return e.name === "xl/sharedStrings.xml"; });
  if(sst) sst.data = new TextEncoder().encode(dropUnusedShared(xml, new TextDecoder().decode(sst.data)));
  return new Uint8Array(await (await buildZip(entries)).arrayBuffer());
}

// dossier complet (ZIP du formulaire) -> copie club (ZIP : AF réduit + Commitment)
async function buildClubCopy(zipBuf){
  const entries = await unzip(zipBuf);
  const af = entries.find(function(e){ return /\.xlsx$/i.test(zipBase(e.name)); });
  const cm = entries.find(function(e){ return /^Commitment.*\.docx$/i.test(zipBase(e.name)); });
  if(!af) throw new Error("no application form (.xlsx) in the ZIP");
  const files = [{ name: zipBase(af.name).replace(/\.xlsx$/i, "_CLUB-COPY.xlsx"), data: await redactApplicationForm(af.data) }];
  if(cm) files.push({ name: zipBase(cm.name), data: cm.data });
  return buildZip(files, "application/zip");
}
