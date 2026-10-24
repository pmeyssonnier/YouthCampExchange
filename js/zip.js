// zip.js — lecture des archives ZIP (aussi .xlsx / .docx), commune à toutes les pages.
// Les archives viennent de l'extérieur (candidats, répertoire international) : la lecture
// est bornée pour qu'un fichier piégé ne puisse pas bloquer ou saturer le navigateur.
"use strict";
const ZIP_LIMITS = {
  entries: 500,                  // nombre de fichiers dans l'archive
  entryBytes: 60 * 1024 * 1024,  // taille décompressée d'un fichier
  totalBytes: 150 * 1024 * 1024, // taille décompressée cumulée
  ratio: 200,                    // compression max d'un fichier de plus de 1 Mo (bombe ZIP au-delà)
  ratioFrom: 1024 * 1024,
  archiveBytes: 100 * 1024 * 1024, // taille de l'archive elle-même, vérifiée avant de la lire
  nameLength: 512                // longueur d'un nom de fichier
};
// Noms refusés : caractères de contrôle et caractères d'inversion de sens d'écriture, qui
// permettent de déguiser une extension (« photo\u202Egpj.exe » s'affiche « photoexe.jpg »).
const ZIP_BAD_NAME = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

// Budget de décompression partagé par toutes les archives d'une même opération (un ZIP de
// candidature et les .xlsx / .docx qu'il contient) : sans lui, chaque fichier imbriqué disposerait
// de son propre plafond et 500 petits fichiers pourraient faire décompresser des dizaines de Go.
function zipBudget(bytes){ return { left: bytes || 2 * ZIP_LIMITS.totalBytes }; }

// Taille d'un fichier choisi par l'utilisateur, avant de le charger en mémoire.
function zipCheckSize(file){
  if(file && file.size > ZIP_LIMITS.archiveBytes)
    throw new Error("file too large (" + Math.round(file.size / 1048576) + " MB, maximum " + ZIP_LIMITS.archiveBytes / 1048576 + " MB)");
}

// Annuaire central de l'archive : noms et positions, sans rien décompresser.
// Rejette les archives mal formées, trop grandes, ou contenant des chemins dangereux.
function zipDirectory(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(buf), len = u8.length;
  let eocd = -1;
  for(let i = len - 22; i >= Math.max(0, len - 22 - 65536); i--){
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error("not a valid ZIP / Office file");
  if(len > ZIP_LIMITS.archiveBytes) throw new Error("archive too large");
  const count = dv.getUint16(eocd + 10, true);
  if(count > ZIP_LIMITS.entries) throw new Error("archive has too many files (" + count + ")");
  let off = dv.getUint32(eocd + 16, true);
  const out = [], seen = new Set(), td = new TextDecoder();
  for(let n = 0; n < count; n++){
    if(off + 46 > len || dv.getUint32(off, true) !== 0x02014b50) throw new Error("corrupted ZIP directory");
    const flags = dv.getUint16(off + 8, true), method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true), usize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true), extraLen = dv.getUint16(off + 30, true), cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    if(off + 46 + nameLen > len || lho + 30 > len) throw new Error("corrupted ZIP directory");
    if(nameLen > ZIP_LIMITS.nameLength) throw new Error("file name too long in archive");
    const name = td.decode(u8.subarray(off + 46, off + 46 + nameLen));
    if(/(^|[\\/])\.\.([\\/]|$)/.test(name) || /^([\\/]|[a-z]:)/i.test(name) || ZIP_BAD_NAME.test(name))
      throw new Error("unsafe path in archive: " + JSON.stringify(name));
    // deux fichiers de même nom : un contrôle pourrait lire l'un et l'utilisateur ouvrir l'autre
    if(seen.has(name.toLowerCase())) throw new Error("duplicate file name in archive: " + name);
    seen.add(name.toLowerCase());
    if(flags & 1) throw new Error("encrypted file in archive: " + name);
    if(dv.getUint32(lho, true) !== 0x04034b50) throw new Error("corrupted ZIP entry: " + name);
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if(start + csize > len) throw new Error("truncated ZIP entry: " + name);
    if(method !== 0 && method !== 8) throw new Error("unsupported compression method: " + method);
    out.push({ name: name, method: method, csize: csize, usize: usize, start: start });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  // données de deux fichiers qui se chevauchent : technique des bombes ZIP « sans imbrication »,
  // où des centaines d'entrées pointent vers les mêmes octets compressés
  const byStart = out.filter(function(e){ return e.csize > 0; }).sort(function(a, b){ return a.start - b.start; });
  for(let i = 1; i < byStart.length; i++)
    if(byStart[i].start < byStart[i - 1].start + byStart[i - 1].csize) throw new Error("overlapping files in archive (ZIP bomb)");
  return out;
}

// Noms des fichiers d'une archive, sans décompression (checklist du coffre, tri rapide).
function zipNames(buf){ return zipDirectory(buf).map(function(e){ return e.name; }); }

// Décompression en flux, arrêtée dès que le plafond est dépassé (la taille annoncée
// dans l'archive peut mentir : seule la taille réellement produite compte).
async function inflateRaw(u8, max){
  const cap = max || ZIP_LIMITS.entryBytes;
  const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const parts = []; let size = 0;
  for(;;){
    const r = await reader.read();
    if(r.done) break;
    size += r.value.length;
    if(size > cap){ try{ await reader.cancel(); }catch(e){} throw new Error("file too large once decompressed"); }
    parts.push(r.value);
  }
  const outU8 = new Uint8Array(size); let p = 0;
  for(const part of parts){ outU8.set(part, p); p += part.length; }
  return outU8;
}

// budget : facultatif, objet de zipBudget() partagé entre plusieurs archives
async function unzip(buf, budget){ // -> [{name, data:Uint8Array}]
  const u8 = new Uint8Array(buf), entries = [];
  let total = 0;
  for(const e of zipDirectory(buf)){
    const raw = u8.subarray(e.start, e.start + e.csize);
    const left = Math.min(ZIP_LIMITS.totalBytes - total, budget ? budget.left : Infinity);
    if(left <= 0) throw new Error(budget && budget.left <= 0 ? "too much data to unpack in one go" : "archive too large once decompressed");
    if(e.method === 0 && e.csize > ZIP_LIMITS.entryBytes) throw new Error("file too large: " + e.name);
    // plafond de ce fichier : taille max, reste du budget, et ratio de compression autorisé —
    // une bombe s'arrête dès le dépassement, sans être décompressée jusqu'au bout
    const ratioCap = Math.max(ZIP_LIMITS.ratioFrom, e.csize * ZIP_LIMITS.ratio);
    let data;
    if(e.method === 8){
      try{ data = await inflateRaw(raw, Math.min(ZIP_LIMITS.entryBytes, left, ratioCap + 1)); }
      catch(err){
        if(/too large once decompressed/.test(err.message) && ratioCap < Math.min(ZIP_LIMITS.entryBytes, left))
          throw new Error("suspicious compression ratio in " + e.name);
        if(/too large once decompressed/.test(err.message) && left < ZIP_LIMITS.entryBytes)
          throw new Error(budget && budget.left < ZIP_LIMITS.totalBytes - total ? "too much data to unpack in one go" : "archive too large once decompressed");
        throw err;
      }
    }else data = raw.slice();
    if(data.length > ZIP_LIMITS.ratioFrom && e.csize > 0 && data.length / e.csize > ZIP_LIMITS.ratio)
      throw new Error("suspicious compression ratio in " + e.name);
    total += data.length;
    if(budget) budget.left -= data.length;
    if(total > ZIP_LIMITS.totalBytes) throw new Error("archive too large once decompressed");
    entries.push({ name: e.name, data: data });
  }
  return entries;
}
