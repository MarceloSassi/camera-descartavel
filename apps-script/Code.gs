/**
 * Backend exclusivo do casamento de Lorena e Marcelo.
 *
 * A pasta indicada em ROOT_FOLDER_ID será a própria pasta final das fotos.
 * Não existe lógica de múltiplos eventos neste MVP.
 */

const CONFIG = {
  ROOT_FOLDER_ID: 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE',
  PHOTO_LIMIT: 20,
  PUBLIC_GALLERY: true,
  MAX_BASE64_CHARS: 4 * 1024 * 1024
};

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'status');

  if (action === 'list') {
    return jsonp_(e, listPhotos_());
  }

  return jsonp_(e, {
    ok: true,
    service: 'casamento-lorena-marcelo',
    photoLimit: CONFIG.PHOTO_LIMIT,
    publicGallery: CONFIG.PUBLIC_GALLERY
  });
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '');

    if (action !== 'upload') {
      return text_('Ação inválida.');
    }

    const result = uploadPhoto_(p);
    return text_(result.ok ? 'OK' : `ERRO: ${result.error}`);
  } catch (err) {
    return text_(`ERRO: ${err && err.message ? err.message : err}`);
  }
}

function uploadPhoto_(p) {
  const guestId = sanitizeGuestId_(p.guestId);
  const filename = sanitizeFilename_(p.filename || 'foto.jpg');
  const mimeType = String(p.mimeType || 'image/jpeg');
  const imageBase64 = String(p.imageBase64 || '');

  if (!guestId) return { ok: false, error: 'Convidado inválido.' };
  if (!imageBase64) return { ok: false, error: 'Imagem vazia.' };
  if (imageBase64.length > CONFIG.MAX_BASE64_CHARS) return { ok: false, error: 'Imagem grande demais.' };
  if (mimeType !== 'image/jpeg') return { ok: false, error: 'Formato não permitido.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const props = PropertiesService.getScriptProperties();
    const countKey = `lorena-marcelo:${guestId}`;
    const current = Number(props.getProperty(countKey) || 0);

    if (current >= CONFIG.PHOTO_LIMIT) {
      return { ok: false, error: 'Limite de fotos atingido.' };
    }

    const folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    const bytes = Utilities.base64Decode(imageBase64);
    const blob = Utilities.newBlob(bytes, mimeType, filename);
    const file = folder.createFile(blob);

    if (CONFIG.PUBLIC_GALLERY) {
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        // Algumas contas Workspace bloqueiam compartilhamento público.
      }
    }

    props.setProperty(countKey, String(current + 1));

    return { ok: true, fileId: file.getId(), count: current + 1 };
  } finally {
    lock.releaseLock();
  }
}

function listPhotos_() {
  try {
    if (!CONFIG.PUBLIC_GALLERY) {
      return { ok: false, error: 'Galeria pública desativada.' };
    }

    const folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    const files = folder.getFiles();
    const photos = [];

    while (files.hasNext()) {
      const file = files.next();
      if (!String(file.getMimeType()).startsWith('image/')) continue;
      const id = file.getId();
      photos.push({
        id: id,
        name: file.getName(),
        createdAt: file.getDateCreated().toISOString(),
        thumbUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w900`,
        fullUrl: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
      });
    }

    photos.sort(function(a, b) {
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    return { ok: true, photos: photos };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function sanitizeGuestId_(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
}

function sanitizeFilename_(value) {
  const clean = String(value || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
  return clean.toLowerCase().endsWith('.jpg') ? clean : `${clean}.jpg`;
}

function text_(value) {
  return ContentService.createTextOutput(String(value)).setMimeType(ContentService.MimeType.TEXT);
}

function jsonp_(e, payload) {
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * Zera a contagem de fotos de todos os convidados no servidor.
 * Rode manualmente pelo editor (selecione "resetarLimites" e clique em Executar).
 * Não é acessível pelo site. Veja RESETAR-LIMITE.md.
 */
function resetarLimites() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  let total = 0;
  Object.keys(all).forEach(function (key) {
    if (key.indexOf('lorena-marcelo:') === 0) {
      props.deleteProperty(key);
      total++;
    }
  });
  Logger.log(total + ' contagem(ns) zerada(s).');
}
