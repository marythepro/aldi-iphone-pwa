const $ = s => document.querySelector(s);
const list = $('#list');
// Keep the original key and array format so existing quantities/checkmarks survive.
const stateKey = 'aldi-pwa-items-v1';
const maxQty = 9999;
let items = [], filter = 'all', focusIndex = -1, toastTimer;

// The same controls remain usable when a desktop window is resized or zoomed.
$('.add-section').open = matchMedia('(min-width: 960px)').matches;
if ('ResizeObserver' in window) {
  new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty('--header-height', entry.target.offsetHeight + 'px');
  }).observe($('header'));
}

function searchUrl(name) {
  return 'https://www.aldi.us/store/aldi/s?k=' + encodeURIComponent(name);
}
function productUrl(item) {
  try {
    const url = new URL(item.direct_url);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch (_) {}
  return searchUrl(item.name);
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
function newId() {
  let id;
  do {
    id = 'item-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
  } while (items.some(item => item.id === id));
  return id;
}
function withIds(source) {
  const used = new Set();
  return source.map((item, index) => {
    let id = typeof item.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(item.id) ? item.id : 'original-' + index;
    while (used.has(id)) id += '-duplicate';
    used.add(id);
    return {...item, id};
  });
}
function commit(next) {
  try {
    localStorage.setItem(stateKey, JSON.stringify(next));
    items = next;
    render();
    return true;
  } catch (_) {
    toast('Could not save changes on this device. Please free up storage and try again.', 6000);
    return false;
  }
}
function activeItems() { return items.filter(item => !item.removed); }
function visible() {
  const query = $('#search').value.trim().toLowerCase();
  return activeItems().filter(item => (!query || item.name.toLowerCase().includes(query)) &&
    (filter === 'all' || (filter === 'done' ? item.checked : !item.checked)));
}
function lastRemoved() {
  return items.filter(item => item.removed).reduce((latest, item) =>
    !latest || item.removedAt > latest.removedAt ? item : latest, null);
}
function setFilter(value) {
  filter = value;
  focusIndex = -1;
  document.querySelectorAll('.chip').forEach(button => {
    const selected = button.dataset.filter === value;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function render() {
  const active = activeItems(), shown = visible();
  const done = active.filter(item => item.checked).length;
  const totalQty = active.reduce((sum, item) => sum + Number(item.qty), 0);
  $('#summary').textContent = `${active.length} products • ${totalQty} total • ${done} checked`;
  const percent = active.length ? done / active.length * 100 : 0;
  $('#bar').style.width = percent + '%';
  $('.progress').setAttribute('aria-valuenow', String(Math.round(percent)));
  $('.progress').setAttribute('aria-valuetext', `${done} of ${active.length} products checked`);
  $('#results').textContent = `${shown.length} shown · ${active.length - done} to shop`;
  $('#prev').disabled = $('#next').disabled = !shown.length;
  list.innerHTML = shown.length ? shown.map(item => `
    <article class="item ${item.checked ? 'done' : ''}" data-id="${item.id}" aria-labelledby="name-${item.id}">
      <input class="check" type="checkbox" ${item.checked ? 'checked' : ''} aria-label="Check off ${esc(item.name)}">
      <div class="item-info"><h3 class="name" id="name-${item.id}">${esc(item.name)}</h3>
        <div class="meta">Quantity ${item.qty}${item.price != null ? ' • $' + Number(item.price).toFixed(2) + ' each' : ''}</div>
        <div class="links"><a target="_blank" rel="noopener" href="${esc(productUrl(item))}" aria-label="${item.direct_url ? 'Open product' : 'Open ALDI search'} for ${esc(item.name)} (opens in a new tab)">${item.direct_url ? 'Open product' : 'Open ALDI search'}</a></div>
      </div>
      <div class="item-actions"><div class="stepper">
        <button type="button" class="minus" ${item.qty <= 1 ? 'disabled' : ''} aria-label="Decrease quantity of ${esc(item.name)}">−</button>
        <div class="qty">${item.qty}</div>
        <button type="button" class="plus" ${item.qty >= maxQty ? 'disabled' : ''} aria-label="Increase quantity of ${esc(item.name)}">+</button>
      </div><button type="button" class="remove" aria-label="Remove ${esc(item.name)}">Remove</button></div>
    </article>`).join('') : '<p class="empty">' + (active.length ? 'No matching items.' : 'Your list is empty. Add an item above.') + '</p>';
  const removed = lastRemoved();
  $('#undoBar').hidden = !removed;
  if (removed) {
    $('#undoMessage').textContent = `${removed.name} removed.`;
    $('#undo').setAttribute('aria-label', `Undo removal of ${removed.name}`);
  }
}
function focusControl(id, selector, preventScroll = true) {
  const article = list.querySelector(`[data-id="${id}"]`);
  // A quantity button may become disabled at its limit. Keep a usable focus target.
  const control = article?.querySelector(`${selector}:not(:disabled)`) || article?.querySelector('.check');
  control?.focus({preventScroll});
  return Boolean(control);
}
function removeItem(id) {
  const item = items.find(item => item.id === id && !item.removed);
  if (!item) return;
  const shown = visible(), index = shown.findIndex(item => item.id === id);
  const nextFocus = shown[index + 1] || shown[index - 1];
  const removedAt = Math.max(Date.now(), ...items.map(item => Number(item.removedAt) || 0)) + 1;
  if (commit(items.map(item => item.id === id ? {...item, removed:true, removedAt} : item))) {
    if (nextFocus) focusControl(nextFocus.id, '.remove');
    else $('#undo').focus();
    toast(`${item.name} removed. Use Undo to restore it.`);
  }
}
function undoRemove() {
  const removed = lastRemoved();
  if (!removed) return;
  if (commit(items.map(item => item.id === removed.id ? {...item, removed:false, removedAt:0} : item))) {
    // Reveal the restored item even if the user changed search or filter.
    $('#search').value = '';
    setFilter('all');
    render();
    focusControl(removed.id, '.remove', false);
    toast(`${removed.name} restored`);
  }
}
list.onclick = event => {
  const button = event.target.closest('button');
  const article = button?.closest('.item');
  if (!article) return;
  const id = article.dataset.id;
  if (button.classList.contains('remove')) return removeItem(id);
  const delta = button.classList.contains('plus') ? 1 : button.classList.contains('minus') ? -1 : 0;
  if (!delta) return;
  if (commit(items.map(item => item.id === id ? {...item, qty:Math.min(maxQty, Math.max(1, Number(item.qty) + delta))} : item))) {
    focusControl(id, delta > 0 ? '.plus' : '.minus');
    const item = items.find(item => item.id === id);
    toast(`${item.name}: quantity ${item.qty}`);
  }
};
list.onchange = event => {
  if (!event.target.classList.contains('check')) return;
  const id = event.target.closest('.item').dataset.id;
  const checked = event.target.checked;
  const index = visible().findIndex(item => item.id === id);
  if (!commit(items.map(item => item.id === id ? {...item, checked} : item))) render();
  if (!focusControl(id, '.check')) {
    // Checking in "To shop" (or unchecking in "Checked") removes this row.
    const shown = visible(), next = shown[Math.min(index, shown.length - 1)];
    if (next) focusControl(next.id, '.check', false);
    else $('#shopping').focus();
  }
};
list.addEventListener('focusin', event => {
  const article = event.target.closest('.item');
  if (article) focusIndex = visible().findIndex(item => item.id === article.dataset.id);
});
$('#undo').onclick = undoRemove;
$('#search').oninput = () => { focusIndex = -1; render(); };
document.querySelectorAll('.chip').forEach(button => button.onclick = () => { setFilter(button.dataset.filter); render(); });

$('#addForm').onsubmit = event => {
  event.preventDefault();
  const nameInput = $('#itemName'), qtyInput = $('#itemQty');
  const name = nameInput.value.trim().replace(/\s+/g, ' '), qty = Number(qtyInput.value);
  nameInput.setCustomValidity(name ? '' : 'Enter an item name.');
  qtyInput.setCustomValidity(Number.isSafeInteger(qty) && qty >= 1 && qty <= maxQty ? '' : 'Enter a whole quantity from 1 to 9999.');
  if (!$('#addForm').reportValidity()) return;
  const item = {id:newId(), name, qty, checked:false, price:null, category:'Shopping List', direct_url:'', custom:true};
  if (commit([item, ...items])) {
    $('#addForm').reset();
    $('#search').value = '';
    setFilter('open');
    render();
    nameInput.focus();
    toast(`${name} added`);
  }
};
$('#itemName').oninput = () => $('#itemName').setCustomValidity('');
$('#itemQty').oninput = () => $('#itemQty').setCustomValidity('');
function jump(direction) {
  const shown = visible();
  if (!shown.length) return;
  focusIndex = focusIndex < 0 ? (direction > 0 ? 0 : shown.length - 1) :
    (focusIndex + direction + shown.length) % shown.length;
  const id = shown[focusIndex].id;
  focusControl(id, '.check');
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  list.querySelector(`[data-id="${id}"]`)?.scrollIntoView({behavior, block:'center'});
}
$('#next').onclick = () => jump(1);
$('#prev').onclick = () => jump(-1);
function textList() {
  return activeItems().filter(item => !item.checked).map(item => `${item.qty} x ${item.name}`).join('\n') || (activeItems().length ? 'All items checked off.' : 'Shopping list is empty.');
}
async function share() {
  const text = textList();
  try {
    if (navigator.share) await navigator.share({title:'ALDI Shopping List', text});
    else { await navigator.clipboard.writeText(text); toast('List copied'); }
  } catch (error) { if (error.name !== 'AbortError') toast('Could not share the list. Please try again.'); }
}
$('#shareTop').onclick = share;
$('#copy').onclick = async () => {
  try { await navigator.clipboard.writeText(textList()); toast('List copied'); }
  catch (_) { toast('Could not copy the list. Please use Share.'); }
};
function toast(message, duration = 3000) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  toastTimer = setTimeout(() => { $('#toast').style.display = 'none'; }, duration);
}
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('#installApp').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('#installApp').hidden = true;
  toast('ALDI List installed');
});
$('#installApp').onclick = async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  $('#installApp').hidden = true;
  try { await prompt.prompt(); }
  catch (_) { toast('Please use the browser install instructions.'); }
  $('#helpTitle').focus();
};
$('#installHelp').onclick = () => {
  $('#help').showModal();
  $('#helpTitle').focus();
};
$('#closeHelp').onclick = () => $('#help').close();
(async () => {
  try {
    const saved = localStorage.getItem(stateKey);
    const source = saved === null ? await fetch('cart_items.json').then(response => {
      if (!response.ok) throw new Error('List unavailable');
      return response.json();
    }) : JSON.parse(saved);
    if (!Array.isArray(source) || source.some(item => !item || typeof item.name !== 'string' || !Number.isSafeInteger(item.qty) || item.qty < 1)) throw new Error('Invalid saved list');
    items = withIds(source);
    // IDs are the only migration; never replace saved items with the source list.
    if (JSON.stringify(items) !== saved) {
      try { localStorage.setItem(stateKey, JSON.stringify(items)); }
      catch (_) { toast('Your list is visible, but this device could not save it.', 6000); }
    }
    setFilter('all');
    render();
    $('#addFields').disabled = false;
  } catch (_) {
    $('#summary').textContent = 'List could not load';
    list.innerHTML = '<p class="empty">Your saved list has not been changed. Please reconnect and reload to try again.</p>';
  }
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    const alreadyControlled = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alreadyControlled && !refreshing) { refreshing = true; location.reload(); }
    });
    try {
      const registration = await navigator.serviceWorker.register('sw.js', {updateViaCache:'none'});
      registration.update().catch(() => {});
    } catch (_) {}
  }
})();
