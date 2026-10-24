"""Fabrique les archives de test (dossiers de candidats, archives piégées) dans tests/.fixtures."""
import os, random, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIX = os.path.join(HERE, '.fixtures')
ZT, VZ = os.path.join(FIX, 'ziptest'), os.path.join(FIX, 'vaultzip')
os.makedirs(ZT, exist_ok=True); os.makedirs(VZ, exist_ok=True)

def z(path, entries, method=zipfile.ZIP_DEFLATED, level=None):
    with zipfile.ZipFile(path, 'w', method, compresslevel=level) as f:
        for name, data in entries: f.writestr(name, data)

# archives piégées
z(os.path.join(ZT, 'bomb_big.zip'), [('a.bin', b'\0' * 100 * 1024 * 1024)])        # 100 Mo décompressés
z(os.path.join(ZT, 'bomb_ratio.zip'), [('a.bin', b'\0' * 30 * 1024 * 1024)])       # ratio ~1000
# 4 × 40 Mo peu compressibles (4 symboles, ratio ~4) : archive ~40 Mo, 160 Mo cumulés une fois décompressée
low = os.urandom(40 * 1024 * 1024).translate(bytes(b % 4 + 65 for b in range(256)))
z(os.path.join(ZT, 'bomb_total.zip'), [(f'p{i}.bin', low) for i in range(4)], level=1)
# archive elle-même trop grande (110 Mo stockés)
blk = os.urandom(64 * 1024)
z(os.path.join(ZT, 'too_big.zip'), [('big.bin', blk * (110 * 16))], zipfile.ZIP_STORED)
# bombe « sans imbrication » : 300 entrées de l'annuaire pointent vers les mêmes octets compressés
def overlap(path, n=300):
    import struct, zlib
    data = zlib.compress(b'\0' * 900_000)[2:-4]; crc = zlib.crc32(b'\0' * 900_000)
    lh = struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0, 8, 0, 0, crc, len(data), 900_000, 1, 0) + b'a' + data
    cd = b''
    for i in range(n):
        nm = f'f{i}.bin'.encode()
        cd += struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0, 8, 0, 0, crc, len(data), 900_000, len(nm), 0, 0, 0, 0, 0, 0) + nm
    eocd = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, n, n, len(cd), len(lh), 0)
    open(path, 'wb').write(lh + cd + eocd)
overlap(os.path.join(ZT, 'overlap.zip'))
import warnings
with warnings.catch_warnings():
    warnings.simplefilter('ignore')
    z(os.path.join(ZT, 'dup.zip'), [('Application_form.xlsx', 'a'), ('Application_form.xlsx', 'b')])
z(os.path.join(ZT, 'bidi.zip'), [('Pass_photo_\u202egpj.exe', 'x')])
# fichier marqué chiffré (bit 0 des drapeaux de l'annuaire)
z(os.path.join(ZT, 'encrypted.zip'), [('secret.txt', 'x' * 100)])
b = bytearray(open(os.path.join(ZT, 'encrypted.zip'), 'rb').read()); i = b.find(b'PK\x01\x02'); b[i + 8] |= 1
open(os.path.join(ZT, 'encrypted.zip'), 'wb').write(b)
z(os.path.join(ZT, 'traversal.zip'), [('../../evil.txt', 'x')])
z(os.path.join(ZT, 'many.zip'), [(f'f{i}.txt', 'x') for i in range(600)])
with open(os.path.join(ZT, 'not_a_zip.zip'), 'wb') as f: f.write(b'hello world' * 100)
# dossier de candidat réaliste, à partir des vrais modèles du dépôt
with zipfile.ZipFile(os.path.join(ZT, 'candidate.zip'), 'w', zipfile.ZIP_DEFLATED) as f:
    f.write(os.path.join(ROOT, 'documents', 'Application_form_2026_MD112.xlsx'), 'Application_form_2027_112A_Doe_Jane.xlsx')
    f.write(os.path.join(ROOT, 'documents', 'Commitment to Reciprocity.docx'), 'Commitment_to_Reciprocity_2027_112A_Doe_Jane.docx')
    f.writestr('Pass_photo_2027_112A_Doe_Jane.jpg', os.urandom(300000))
# versions successives d'un dossier pour le coffre : vrais AF et Commitment (la copie club en est tirée)
AF = open(os.path.join(ROOT, 'documents', 'Application_form_2026_MD112.xlsx'), 'rb').read()
CM = open(os.path.join(ROOT, 'documents', 'Commitment to Reciprocity.docx'), 'rb').read()
v1 = [('Application_form_2027_112A_Doe_Jane.xlsx', AF), ('Commitment_to_Reciprocity_2027_112A_Doe_Jane.docx', CM),
      ('Pass_photo_2027_112A_Doe_Jane.jpg', b'jpg'), ('Payment_proof_2027_112A_Doe_Jane.pdf', b'%PDF-1.4')]
z(os.path.join(VZ, 'Dossier_v1.zip'), v1)   # incomplet : ni pièce d'identité ni lettre
z(os.path.join(VZ, 'Dossier_v2.zip'), v1 + [('ID_document_2027_112A_Doe_Jane.pdf', b'%PDF-1.4 passport'),
                                            ('Letter_to_Host_Family_2027_112A_Doe_Jane.pdf', b'%PDF-1.4 letter')])
z(os.path.join(VZ, 'Dossier_late.zip'), v1 + [('ID_document_TO_FOLLOW_2027_112A_Doe_Jane.txt', b'Passport being renewed'),
                                              ('Letter_to_Host_Family_2027_112A_Doe_Jane.pdf', b'%PDF-1.4 letter')])
print('fixtures written to', FIX)
