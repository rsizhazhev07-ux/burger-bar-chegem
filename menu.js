const controls = document.querySelector('.menu-controls');
const filters = controls.querySelector('.filters');
const search = document.querySelector('#dish-search');
const status = document.querySelector('#menu-status');
const content = document.querySelector('.menu-content');
const empty = document.querySelector('#menu-empty');
const filterButtons = [...filters.querySelectorAll('[data-filter]')];
const itemTemplate = document.querySelector('#item-template');
const lineTemplate = document.querySelector('#cart-line-template');

const dishDialog = document.querySelector('#dish-dialog');
const sizeField = document.querySelector('#dish-sizes');
const dishAdd = document.querySelector('#dish-add');
const cartDialog = document.querySelector('#cart-dialog');
const cartList = document.querySelector('#cart-lines');
const cartFeedback = document.querySelector('#cart-feedback');
const orderForm = document.querySelector('#order-form');
const orderAddress = document.querySelector('#order-address');
const orderComment = document.querySelector('#order-comment');
const orderMessage = document.querySelector('#order-message');
const cartButtons = [...document.querySelectorAll('[data-open-cart]')];

const choices = new Map();
const products = new Map();
const cartKey = 'burger-bar-order-v1';
const money = new Intl.NumberFormat('ru-RU');
const plural = new Intl.PluralRules('ru');
const nouns = { one: 'позиция', few: 'позиции', many: 'позиций', other: 'позиций' };
const formatPrice = (price) => money.format(price) + '\u00a0₽';
const readPrice = (node) => Number(node.textContent.replace(/\D/g, ''));
const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();

function renderMedia(container, product, lazy = false) {
  container.replaceChildren();
  container.classList.toggle('missing-photo', !product.photo);

  if (!product.photo) {
    const label = document.createElement('span');
    label.textContent = 'Фото скоро';
    container.append(label);
    return;
  }

  const image = document.createElement('img');
  image.src = product.photo;
  image.alt = '';
  if (lazy) image.loading = 'lazy';
  image.addEventListener('error', () => renderMedia(container, { photo: '' }), { once: true });
  container.append(image);
}

function createCard(product) {
  const card = itemTemplate.content.firstElementChild.cloneNode(true);
  const open = card.querySelector('.item-open');
  const add = card.querySelector('.item-add');
  const name = card.querySelector('.item-name');
  const multiSize = product.options.length > 1;
  renderMedia(card.querySelector('.item-media'), product, true);
  name.textContent = product.name;
  if (product.portion) {
    const portion = document.createElement('small');
    portion.textContent = product.portion;
    name.append(portion);
  }
  open.setAttribute('aria-label', 'Подробнее: ' + product.name);
  open.dataset.product = product.id;
  card.querySelector('.item-price').textContent =
    (multiSize ? 'от ' : '') + formatPrice(Math.min(...product.options.map((option) => option.price)));
  add.textContent = multiSize ? 'Размер' : '+';
  add.setAttribute('aria-label', (multiSize ? 'Выбрать размер: ' : 'В корзину: ') + product.name);
  if (multiSize) {
    add.dataset.product = product.id;
  } else {
    add.dataset.addChoice = product.options[0].id;
  }
  return card;
}

const categories = [...content.querySelectorAll('.menu-category')].map((section) => {
  const id = section.dataset.category;
  const heading = section.querySelector('h3');
  const category = heading.textContent.trim();

  const groups = [...section.querySelectorAll('.menu-group')].map((group, groupIndex) => {
    const groupName = group.querySelector('h4')?.textContent.trim() ?? '';
    const source = group.querySelector('.price-list, .price-table');
    const sizes = [...source.querySelectorAll('thead th')].slice(1).map((cell) => cell.textContent.trim());
    const grid = document.createElement('ul');
    grid.className = 'product-grid';
    grid.setAttribute('role', 'list');

    const entries = [...source.querySelectorAll('.menu-row, tbody tr')].map((row) => {
      const portion = row.querySelector('.menu-quantity')?.textContent.trim() ?? '';
      const shortName = row.firstElementChild.firstChild.textContent.trim();
      const name = sizes.length && shortName !== groupName
        ? groupName + ' ' + shortName.toLocaleLowerCase('ru')
        : shortName;
      const composition = row.querySelector('.menu-description')?.textContent.trim() ?? '';
      const info = row.dataset.info ?? '';
      const productId = [id, groupIndex, normalize(shortName)].join('/');
      const product = { id: productId, name, portion, category, groupName, composition, info, photo: row.dataset.photo };
      product.options = [...row.querySelectorAll('strong, td')].map((node, index) => {
        const option = { id: productId + '/' + index, label: sizes[index] ?? '', price: readPrice(node), product };
        choices.set(option.id, option);
        return option;
      });
      products.set(productId, product);
      const card = createCard(product);
      grid.append(card);
      return { card, terms: normalize([category, groupName, name, composition, info].join(' ')) };
    });
    source.replaceWith(grid);
    return { group, entries };
  });

  return { section, heading, id, groups };
});

let activeCategory = categories.find(({ heading }) => '#' + heading.id === location.hash)?.id ?? 'all';

function renderMenu() {
  const query = normalize(search.value);
  const words = query ? query.split(/\s+/) : [];
  const selected = query ? 'all' : activeCategory;
  let count = 0;
  filterButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === selected)));

  for (const { section, id, groups } of categories) {
    const inCategory = selected === 'all' || selected === id;
    let sectionCount = 0;

    for (const { group, entries } of groups) {
      let groupCount = 0;
      for (const { card, terms } of entries) {
        const visible = inCategory && words.every((word) => terms.includes(word));
        card.hidden = !visible;
        if (visible) groupCount += 1;
      }
      group.hidden = groupCount === 0;
      sectionCount += groupCount;
    }

    section.hidden = sectionCount === 0;
    count += sectionCount;
  }
  empty.hidden = count !== 0;
  status.textContent = count + ' ' + nouns[plural.select(count)];
}

filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  const belowStart = content.getBoundingClientRect().top < controls.offsetHeight;
  activeCategory = button.dataset.filter;
  search.value = '';
  renderMenu();
  if (belowStart) content.scrollIntoView({ block: 'start' });
});
search.addEventListener('input', renderMenu);

let selectedChoice;
function openDish(product) {
  renderMedia(document.querySelector('#dish-media'), product);
  document.querySelector('#dish-title').textContent = product.name;
  document.querySelector('#dish-category').textContent = product.groupName || product.category;
  document.querySelector('#dish-composition').textContent =
    product.composition || 'Уточните точный состав у Burger Bar при заказе.';
  const info = document.querySelector('#dish-info');
  info.textContent = product.info;
  info.hidden = !product.info;
  const quantity = document.querySelector('#dish-quantity');
  quantity.textContent = product.portion;
  quantity.hidden = !product.portion;

  selectedChoice = product.options[0];
  dishAdd.querySelector('span').textContent = formatPrice(selectedChoice.price);
  sizeField.hidden = product.options.length < 2;
  const sizeOptions = sizeField.querySelector('.choice-options');
  sizeOptions.replaceChildren();
  if (!sizeField.hidden) {
    for (const option of product.options) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'dish-size';
      radio.value = option.id;
      radio.checked = option === selectedChoice;
      const caption = document.createElement('span');
      caption.textContent = option.label + ' · ' + formatPrice(option.price);
      label.append(radio, caption);
      sizeOptions.append(label);
    }
  }
  dishDialog.showModal();
}

sizeField.addEventListener('change', (event) => {
  selectedChoice = choices.get(event.target.value);
  dishAdd.querySelector('span').textContent = formatPrice(selectedChoice.price);
});

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) ?? '[]');
    return new Map(saved.filter((entry) => Array.isArray(entry) && choices.has(entry[0]) &&
      Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] <= 99));
  } catch {
    return new Map();
  }
}

let cart = loadCart();
let feedbackTimer;

function refreshBadge() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  for (const button of cartButtons) {
    button.querySelector('[data-cart-count]').textContent = count;
    button.setAttribute('aria-label', 'Корзина, ' + count + ' ' + nouns[plural.select(count)]);
  }
}

function cartItems() {
  return [...cart].map(([id, quantity]) => ({ option: choices.get(id), quantity }));
}

function subtotal(items) {
  return items.reduce((sum, { option, quantity }) => sum + option.price * quantity, 0);
}

function optionDetails(option) {
  return [option.product.groupName || option.product.category, option.label].filter(Boolean).join(' · ');
}

function renderCart() {
  const items = cartItems();
  cartList.replaceChildren();
  document.querySelector('#cart-empty').hidden = items.length > 0;
  orderForm.hidden = items.length === 0;
  document.querySelector('#cart-total').textContent = formatPrice(subtotal(items));

  for (const { option, quantity } of items) {
    const line = lineTemplate.content.firstElementChild.cloneNode(true);
    line.dataset.choice = option.id;
    line.querySelector('.line-name').textContent = option.product.name;
    line.querySelector('.line-detail').textContent = optionDetails(option);
    line.querySelector('.line-price').textContent = formatPrice(option.price * quantity);
    line.querySelector('.line-quantity span').textContent = quantity;
    const decrease = line.querySelector('[data-step="-1"]');
    const increase = line.querySelector('[data-step="1"]');
    decrease.setAttribute('aria-label', (quantity === 1 ? 'Удалить: ' : 'Уменьшить количество: ') + option.product.name);
    increase.setAttribute('aria-label', 'Увеличить количество: ' + option.product.name);
    increase.disabled = quantity >= 99;
    cartList.append(line);
  }
}

function changeQuantity(option, step) {
  const previous = cart.get(option.id) ?? 0;
  const quantity = Math.min(99, previous + step);
  if (quantity === previous) return false;
  if (quantity > 0) cart.set(option.id, quantity);
  else cart.delete(option.id);
  try {
    localStorage.setItem(cartKey, JSON.stringify([...cart]));
  } catch {
    // The cart still works while this page is open.
  }
  refreshBadge();
  if (cartDialog.open) renderCart();
  return true;
}

function addChoice(option) {
  const added = changeQuantity(option, 1);
  cartFeedback.textContent = added ? option.product.name + ' — в корзине' : 'Максимум 99 порций одной позиции.';
  cartFeedback.hidden = false;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { cartFeedback.hidden = true; }, 1700);
}

content.addEventListener('click', (event) => {
  const open = event.target.closest('[data-product]');
  const add = event.target.closest('[data-add-choice]');
  if (open) openDish(products.get(open.dataset.product));
  if (add) addChoice(choices.get(add.dataset.addChoice));
});

dishAdd.addEventListener('click', () => {
  dishDialog.close();
  addChoice(selectedChoice);
});

for (const button of cartButtons) {
  button.hidden = false;
  button.addEventListener('click', () => {
    renderCart();
    cartDialog.showModal();
  });
}

cartList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  const line = button.closest('[data-choice]');
  const id = line.dataset.choice;
  const index = [...cartList.children].indexOf(line);
  const step = Number(button.dataset.step);
  changeQuantity(choices.get(id), step);
  const nextLine = [...cartList.children].find((item) => item.dataset.choice === id) ??
    cartList.children[Math.min(index, cartList.children.length - 1)];
  const nextButton = nextLine?.querySelector('[data-step="' + step + '"]:not(:disabled)') ??
    nextLine?.querySelector('[data-step]:not(:disabled)') ?? cartDialog.querySelector('.dialog-close button');
  nextButton.focus({ preventScroll: true });
});

function deliverySelected() {
  return orderForm.elements.namedItem('method').value === 'delivery';
}

function updateDelivery() {
  const delivery = deliverySelected();
  document.querySelector('#address-field').hidden = !delivery;
  document.querySelector('#pickup-note').hidden = delivery;
  orderAddress.disabled = !delivery;
  orderAddress.required = delivery;
  orderAddress.setCustomValidity('');
}

orderForm.addEventListener('change', (event) => {
  if (event.target.name === 'method') updateDelivery();
});
orderAddress.addEventListener('input', () => orderAddress.setCustomValidity(''));

function buildOrderMessage(items) {
  const message = ['Здравствуйте! Хочу заказать в Burger Bar.', ''];
  for (const { option, quantity } of items) {
    message.push('• ' + option.product.name + ' (' + optionDetails(option) + ') × ' +
      quantity + ' — ' + formatPrice(option.price * quantity));
  }
  message.push('', 'Сумма блюд: ' + formatPrice(subtotal(items)));
  message.push(deliverySelected() ? 'Доставка: ' + orderAddress.value.trim() : 'Самовывоз: ул. Ленина, 100А.');
  const comment = orderComment.value.trim();
  if (comment) message.push('Комментарий: ' + comment);
  return message.join('\n');
}

orderForm.addEventListener('submit', (event) => {
  if (!cart.size) {
    event.preventDefault();
    return;
  }
  if (deliverySelected() && !orderAddress.value.trim()) {
    event.preventDefault();
    orderAddress.setCustomValidity('Введите адрес доставки.');
    orderAddress.reportValidity();
    return;
  }
  orderMessage.value = buildOrderMessage(cartItems());
});

orderForm.addEventListener('formdata', (event) => event.formData.delete('method'));
window.addEventListener('storage', (event) => {
  if (event.key !== cartKey && event.key !== null) return;
  cart = loadCart();
  refreshBadge();
  if (cartDialog.open) renderCart();
});
document.addEventListener('focusin', () => document.documentElement.classList.remove('play-intro'), { once: true });

renderMenu();
refreshBadge();
updateDelivery();
controls.hidden = false;
search.closest('.menu-search').hidden = false;
document.querySelector('[data-cart-fallback]').hidden = true;
