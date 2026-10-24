"""Fabrique les archives de test (dossiers de candidats, archives piégées) dans tests/.fixtures."""
import os, random, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FIX = os.path.join(HERE, '.fixtures')
ZT, VZ = os.path.join(FIX, 'ziptest'), os.path.join(FIX, 'vaultzip')
os.makedirs(ZT, exist_ok=True); os.makedirs(VZ, exist_ok=True)

def z(path, entries, method=zipfile.ZIP_DEFLATED):
    with zipfile.ZipFile(path, 'w', method) as f:
        for name, data in entries: f.writestr(name, data)

# archives piégées
z(os.path.join(ZT, 'bomb_big.zip'), [('a.bin', b'\0' * 100 * 1024 * 1024)])        # 100 Mo décompressés
z(os.path.join(ZT, 'bomb_ratio.zip'), [('a.bin', b'\0' * 30 * 1024 * 1024)])       # ratio ~1000
blk = bytes(random.getrandbits(8) for _ in range(64 * 1024))
z(os.path.join(ZT, 'bomb_total.zip'), [(f'p{i}.bin', blk * (45 * 16)) for i in range(4)], zipfile.ZIP_STORED)  # 180 Mo cumulés
z(os.path.join(ZT, 'traversal.zip'), [('../../evil.txt', 'x')])
z(os.path.join(ZT, 'many.zip'), [(f'f{i}.txt', 'x') for i in range(600)])
with open(os.path.join(ZT, 'not_a_zip.zip'), 'wb') as f: f.write(b'hello world' * 100)
# dossier de candidat réaliste, à partir des vrais modèles du dépôt
with zipfile.ZipFile(os.path.join(ZT, 'candidate.zip'), 'w', zipfile.ZIP_DEFLATED) as f:
    f.write(os.path.join(ROOT, 'Application_form_2026_MD112.xlsx'), 'Application_form_2027_112A_Doe_Jane.xlsx')
    f.write(os.path.join(ROOT, 'Commitment to Reciprocity.docx'), 'Commitment_to_Reciprocity_2027_112A_Doe_Jane.docx')
    f.writestr('Pass_photo_2027_112A_Doe_Jane.jpg', os.urandom(300000))
# versions successives d'un dossier pour le coffre : vrais AF et Commitment (la copie club en est tirée)
AF = open(os.path.join(ROOT, 'Application_form_2026_MD112.xlsx'), 'rb').read()
CM = open(os.path.join(ROOT, 'Commitment to Reciprocity.docx'), 'rb').read()
v1 = [('Application_form_2027_112A_Doe_Jane.xlsx', AF), ('Commitment_to_Reciprocity_2027_112A_Doe_Jane.docx', CM),
      ('Pass_photo_2027_112A_Doe_Jane.jpg', b'jpg'), ('Payment_proof_2027_112A_Doe_Jane.pdf', b'%PDF-1.4')]
z(os.path.join(VZ, 'Dossier_v1.zip'), v1)   # incomplet : ni pièce d'identité ni lettre
z(os.path.join(VZ, 'Dossier_v2.zip'), v1 + [('ID_document_2027_112A_Doe_Jane.pdf', b'%PDF-1.4 passport'),
                                            ('Letter_to_Host_Family_2027_112A_Doe_Jane.pdf', b'%PDF-1.4 letter')])
print('fixtures written to', FIX)
