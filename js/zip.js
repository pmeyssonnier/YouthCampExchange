// zip.js — lecture des archives ZIP (aussi .xlsx / .docx), commune à toutes les pages.
// Les archives viennent de l'extérieur (candidats, répertoire international) : la lecture
// est bornée pour qu'un fichier piégé ne puisse pas bloquer ou saturer le navigateur.
"use strict";
const ZIP_LIMITS = {
  entries: 500,                  // nombre de fichiers dans l'archive
  entryBytes: 60 * 1024 * 1024,  // taille décompressée d'un fichier
  totalBytes: 150 * 1024 * 1024, // taille décompressée cumulée
  ratio: 200,                    // compression max d'un fichier de plus de 1 Mo (bombe ZIP au-delà)
  ratioFrom: 1024 * 1024
};

// Annuaire central de l'archive : noms et positions, sans rien décompresser.
// Rejette les archives mal formées, trop grandes, ou contenant des chemins dangereux.
function zipDirectory(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(buf), len = u8.length;
  let eocd = -1;
  for(let i = len - 22; i >= Math.max(0, len - 22 - 65536); i--){
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error("not a valid ZIP / Office file");
  const count = dv.getUint16(eocd + 10, true);
  if(count > ZIP_LIMITS.entries) throw new Error("archive has too many files (" + count + ")");
  let off = dv.getUint32(eocd + 16, true);
  const out = [], td = new TextDecoder();
  for(let n = 0; n < count; n++){
    if(off + 46 > len || dv.getUint32(off, true) !== 0x02014b50) throw new Error("corrupted ZIP directory");
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true), usize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true), extraLen = dv.getUint16(off + 30, true), cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    if(off + 46 + nameLen > len || lho + 30 > len) throw new Error("corrupted ZIP directory");
    const name = td.decode(u8.subarray(off + 46, off + 46 + nameLen));
    if(/(^|[\\/])\.\.([\\/]|$)/.test(name) || /^([\\/]|[a-z]:)/i.test(name) || name.indexOf("\0") >= 0)
      throw new Error("unsafe path in archive: " + name);
    if(dv.getUint32(lho, true) !== 0x04034b50) throw new Error("corrupted ZIP entry: " + name);
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if(start + csize > len) throw new Error("truncated ZIP entry: " + name);
    if(method !== 0 && method !== 8) throw new Error("unsupported compression method: " + method);
    out.push({ name: name, method: method, csize: csize, usize: usize, start: start });
    off += 46 + nameLen + extraLen + cmtLen;
  }
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

async function unzip(buf){ // -> [{name, data:Uint8Array}]
  const u8 = new Uint8Array(buf), entries = [];
  let total = 0;
  for(const e of zipDirectory(buf)){
    const raw = u8.subarray(e.start, e.start + e.csize);
    const left = ZIP_LIMITS.totalBytes - total;
    if(e.method === 0 && e.csize > ZIP_LIMITS.entryBytes) throw new Error("file too large: " + e.name);
    const data = e.method === 8 ? await inflateRaw(raw, Math.min(ZIP_LIMITS.entryBytes, left)) : raw.slice();
    if(data.length > ZIP_LIMITS.ratioFrom && e.csize > 0 && data.length / e.csize > ZIP_LIMITS.ratio)
      throw new Error("suspicious compression ratio in " + e.name);
    total += data.length;
    if(total > ZIP_LIMITS.totalBytes) throw new Error("archive too large once decompressed");
    entries.push({ name: e.name, data: data });
  }
  return entries;
}
