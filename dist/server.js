// src/shared/rpc.ts
var RPC_EVENT = "nx_inventory:rpc";
var RPC_RESULT_EVENT = "nx_inventory:rpcResult";
var RPC_RATE = 20;
var PUSH_EVENTS = {
  /** el personaje está cargado: inventario propio y definiciones de objetos (una vez por personaje) */
  setup: "nx_inventory:setup",
  /** el personaje sale: el cliente descarta su estado */
  logout: "nx_inventory:logout",
  /** abre la NUI con un inventario secundario (o solo el propio) */
  open: "nx_inventory:open",
  /** cierra la NUI (acceso perdido, inventario borrado...) */
  close: "nx_inventory:close",
  /** cambios parciales de uno o varios inventarios */
  patch: "nx_inventory:patch",
  /** altas y bajas de drops en el mundo */
  drops: "nx_inventory:drops",
  /** definiciones de objetos registradas en caliente por la API */
  items: "nx_inventory:items",
  /** el jugador acaba de tirar algo: si tiene el inventario abierto, que abra ese drop */
  dropOpened: "nx_inventory:dropOpened"
};

// src/shared/types.ts
var INVENTORY_TYPES = ["player", "stash", "trunk", "glovebox", "drop", "shop"];
var FUEL_LIKE_WEAPONS = [
  "WEAPON_PETROLCAN",
  "WEAPON_HAZARDCAN",
  "WEAPON_FERTILIZERCAN",
  "WEAPON_FIREEXTINGUISHER"
];
function normalizeItemName(name2) {
  const lower = name2.toLowerCase();
  return lower.startsWith("weapon_") ? name2.toUpperCase() : lower;
}
function toUiDef(def, buttons) {
  const ui = { name: def.name, label: def.label, weight: def.weight, stack: def.stack, close: def.close };
  if (def.description) ui.description = def.description;
  if (def.image) ui.image = def.image;
  if (buttons && buttons.length > 0) ui.buttons = buttons;
  if (def.weapon) {
    ui.weapon = true;
    if (def.weapon.ammoName) ui.ammoName = def.weapon.ammoName;
  }
  return ui;
}
var ERROR_CODES = [
  "invalid",
  // la petición no tiene la forma esperada
  "busy",
  // ya hay una operación en curso para este jugador
  "rate",
  // demasiadas peticiones
  "not_found",
  // inventario, casilla u objeto inexistente
  "no_access",
  // sin permiso (grupo, dueño, sesión)
  "too_far",
  // fuera de distancia
  "overweight",
  // no cabe por peso
  "no_slot",
  // no hay casilla libre
  "not_enough",
  // cantidad insuficiente
  "cannot_afford",
  // sin dinero en tienda
  "stale",
  // el estado cambió mientras tanto: se reenvía el actual
  "blocked",
  // el jugador no puede actuar (muerto, esposado, en animación)
  "hook",
  // un hook de otro recurso lo ha impedido
  "broken",
  // durabilidad agotada
  "not_restrained",
  // meter en el coche: el otro no está esposado ni inconsciente
  "cannot_use",
  // el objeto no se usa (o no así: sin arma en la mano, accesorio que no encaja…)
  "timeout",
  "internal"
];

// src/shared/validate.ts
var INV_ID = /^[A-Za-z0-9_:.\-]{1,64}$/;
var ITEM_NAME = /^[A-Za-z0-9_\-]{1,64}$/;
var LIMITS = {
  slot: 500,
  count: 2147483647,
  /** server id máximo de FiveM */
  playerId: 65535,
  ammo: 1e4,
  shots: 1e3,
  buttons: 32,
  metadataDepth: 6,
  /** caracteres de JSON.stringify */
  metadataSize: 8192
};
var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isInt = (value, min, max) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
var isSlot = (value) => isInt(value, 1, LIMITS.slot);
var isCount = (value) => isInt(value, 1, LIMITS.count);
var isInvId = (value) => typeof value === "string" && INV_ID.test(value);
var isItemName = (value) => typeof value === "string" && ITEM_NAME.test(value);
function parseSlotRef(value) {
  if (!isRecord(value) || !isInvId(value.inv) || !isSlot(value.slot)) return null;
  return { inv: value.inv, slot: value.slot };
}
function parseEmpty(value) {
  if (value === null || value === void 0) return null;
  if (isRecord(value) && Object.keys(value).length === 0) return null;
  return void 0;
}
function cleanJson(value, depth) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
  if (depth >= LIMITS.metadataDepth) return void 0;
  if (Array.isArray(value)) {
    const out2 = [];
    for (const entry of value) {
      const clean = cleanJson(entry, depth + 1);
      if (clean === void 0) return void 0;
      out2.push(clean);
    }
    return out2;
  }
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return void 0;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return void 0;
    const clean = cleanJson(entry, depth + 1);
    if (clean === void 0) return void 0;
    out[key] = clean;
  }
  return out;
}
function sanitizeMetadata(value) {
  if (value === void 0 || value === null) return {};
  const clean = cleanJson(value, 0);
  if (clean === void 0 || !isRecord(clean)) return null;
  if (JSON.stringify(clean).length > LIMITS.metadataSize) return null;
  return clean;
}
var parseUse = (v) => isRecord(v) && isSlot(v.slot) ? { slot: v.slot } : null;
var parseDrop = (v) => isRecord(v) && isSlot(v.slot) && isCount(v.count) ? { slot: v.slot, count: v.count } : null;
var parseButton = (v) => isRecord(v) && isSlot(v.slot) && isInt(v.button, 0, LIMITS.buttons - 1) ? { slot: v.slot, button: v.button } : null;
var parseComponent = (v) => isRecord(v) && isSlot(v.slot) && isItemName(v.component) ? { slot: v.slot, component: v.component } : null;
function parseMove(v) {
  if (!isRecord(v) || !isCount(v.count) || !isItemName(v.expect)) return null;
  const from = parseSlotRef(v.from);
  const to = parseSlotRef(v.to);
  if (!from || !to || from.inv === to.inv && from.slot === to.slot) return null;
  return { from, to, count: v.count, expect: v.expect };
}
function parseBuy(v) {
  if (!isRecord(v) || !isInvId(v.shop) || !isSlot(v.slot) || !isCount(v.count)) return null;
  if (v.toSlot !== void 0 && !isSlot(v.toSlot)) return null;
  const out = { shop: v.shop, slot: v.slot, count: v.count };
  if (v.toSlot !== void 0) out.toSlot = v.toSlot;
  return out;
}
var isCoord = (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e5;
function parseOpen(v) {
  if (!isRecord(v) || !INVENTORY_TYPES.includes(v.type)) return null;
  const out = { type: v.type };
  if (v.id !== void 0) {
    if (!isInvId(v.id) && !isInt(v.id, 1, LIMITS.count)) return null;
    out.id = v.id;
  }
  if (v.coords !== void 0) {
    const [x, y, z, extra] = Array.isArray(v.coords) ? v.coords : [];
    if (!isCoord(x) || !isCoord(y) || !isCoord(z) || extra !== void 0) return null;
    out.coords = [x, y, z];
  }
  if (v.vehicleClass !== void 0) {
    if (!isInt(v.vehicleClass, 0, 22)) return null;
    out.vehicleClass = v.vehicleClass;
  }
  return out;
}
var RPC_PARSERS = {
  open: parseOpen,
  close: () => null,
  // sin argumentos: lo decide parseRpcArgs
  move: parseMove,
  use: parseUse,
  give: (v) => isRecord(v) && isSlot(v.slot) && isCount(v.count) && isInt(v.target, 1, LIMITS.playerId) ? { slot: v.slot, count: v.count, target: v.target } : null,
  drop: parseDrop,
  vehicle: (v) => isRecord(v) && isInt(v.target, 1, LIMITS.playerId) && (v.netId === void 0 || isInt(v.netId, 1, 2147483647)) ? { target: v.target, ...v.netId !== void 0 ? { netId: v.netId } : {} } : null,
  buy: parseBuy,
  button: parseButton,
  removeComponent: parseComponent,
  removeAmmo: parseUse,
  updateWeapon: (v) => isRecord(v) && isSlot(v.slot) && isInt(v.ammo, 0, LIMITS.ammo) && isInt(v.shots, 0, LIMITS.shots) ? { slot: v.slot, ammo: v.ammo, shots: v.shots } : null,
  resync: (v) => isRecord(v) && isInvId(v.inv) ? { inv: v.inv } : null,
  useDone: (v) => isRecord(v) && isInt(v.token, 1, LIMITS.count) && typeof v.success === "boolean" ? { token: v.token, success: v.success } : null,
  reload: (v) => isRecord(v) && isInt(v.ammo, 0, LIMITS.ammo) ? { ammo: v.ammo } : null,
  throw: () => null,
  addComponent: parseUse,
  disarm: () => null
};
var RPC_NO_ARGS = /* @__PURE__ */ new Set(["close", "throw", "disarm"]);
function parseRpcArgs(op, value) {
  if (RPC_NO_ARGS.has(op)) return parseEmpty(value) === null ? { ok: true, args: null } : { ok: false };
  const args = RPC_PARSERS[op](value);
  return args === null ? { ok: false } : { ok: true, args };
}
var isRpcOp = (value) => typeof value === "string" && Object.prototype.hasOwnProperty.call(RPC_PARSERS, value);

// src/server/core/hooks.ts
var HOOK_EVENTS = ["swapItems", "openInventory", "createItem", "buyItem", "usingItem"];
function luaPatternToRegExp(pattern) {
  const classes = {
    a: "A-Za-z",
    d: "0-9",
    w: "A-Za-z0-9",
    s: "\\s",
    l: "a-z",
    u: "A-Z",
    p: "!-/:-@\\[-`{-~",
    x: "0-9A-Fa-f"
  };
  let out = "";
  let inSet = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "%") {
      const next = pattern[++i] ?? "";
      const cls = classes[next.toLowerCase()];
      if (cls) {
        const negated = next !== next.toLowerCase();
        out += inSet ? cls : negated ? `[^${cls}]` : `[${cls}]`;
      } else {
        out += next.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
      }
      continue;
    }
    if (inSet) {
      if (ch === "]") inSet = false;
      out += ch === "\\" ? "\\\\" : ch;
      continue;
    }
    if (ch === "[") {
      inSet = true;
      out += ch;
    } else if (ch === "-") {
      out += "*?";
    } else if (ch === "^" && i === 0) {
      out += ch;
    } else if (ch === "$" && i === pattern.length - 1) {
      out += ch;
    } else if (ch === "." || ch === "*" || ch === "+" || ch === "?") {
      out += ch;
    } else {
      out += ch.replace(/[\\^$()[\]{}|/]/g, "\\$&");
    }
  }
  return new RegExp(out);
}
var Hooks = class {
  hooks = /* @__PURE__ */ new Map();
  nextId = 1;
  warn;
  constructor(warn) {
    this.warn = warn;
  }
  register(resource, event, fn, options = {}) {
    const hook = { id: this.nextId++, resource, event, fn, print: options.print === true };
    if (options.inventoryFilter?.length) {
      hook.inventory = [];
      for (const pattern of options.inventoryFilter) {
        try {
          hook.inventory.push(luaPatternToRegExp(pattern));
        } catch {
          this.warn(`hook de ${resource}: patr\xF3n "${pattern}" no v\xE1lido, se ignora`);
        }
      }
    }
    if (options.itemFilter) hook.items = new Set(Object.keys(options.itemFilter).filter((k) => options.itemFilter[k]));
    if (options.typeFilter) hook.types = new Set(Object.keys(options.typeFilter).filter((k) => options.typeFilter[k]));
    const list = this.hooks.get(event) ?? [];
    list.push(hook);
    this.hooks.set(event, list);
    return hook.id;
  }
  /** Quita un hook, o todos los de un recurso si no se da id (al parar ese recurso). */
  remove(resource, id) {
    for (const [event, list] of this.hooks) {
      this.hooks.set(
        event,
        list.filter((hook) => hook.resource !== resource || id !== void 0 && hook.id !== id)
      );
    }
  }
  /**
   * Ejecuta los hooks de un evento. Devuelve false si alguno veta. En
   * createItem, un hook puede devolver metadatos nuevos (se devuelven en `metadata`).
   */
  trigger(event, payload) {
    const list = this.hooks.get(event);
    if (!list || list.length === 0) return { allowed: true };
    const from = str(payload.fromInventory ?? payload.inventoryId ?? payload.shopType);
    const to = str(payload.toInventory);
    const itemNames = [name(payload.fromSlot), name(payload.toSlot), name(payload.item), str(payload.itemName)].filter(Boolean);
    const type = str(payload.inventoryType ?? payload.shopType ?? payload.fromType);
    let metadata;
    for (const hook of list) {
      if (hook.items && !itemNames.some((n) => hook.items.has(n))) continue;
      if (hook.inventory && !hook.inventory.some((re) => re.test(from) || to !== "" && re.test(to))) continue;
      if (hook.types && !hook.types.has(type)) continue;
      if (hook.print) this.warn(`hook ${hook.id} (${hook.resource}) en ${event}`);
      let response;
      const start2 = Date.now();
      try {
        response = hook.fn({ ...payload, hookId: hook.id });
      } catch (err) {
        this.warn(`hook ${hook.id} de ${hook.resource} (${event}) fall\xF3: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const ms = Date.now() - start2;
      if (ms >= 10) this.warn(`hook ${hook.id} de ${hook.resource} (${event}) tard\xF3 ${ms} ms`);
      if (event === "createItem") {
        if (typeof response === "object" && response !== null) metadata = response;
      } else if (response === false) {
        if (hook.print) this.warn(`hook ${hook.id} (${hook.resource}) ha vetado ${event}`);
        return { allowed: false };
      }
    }
    return metadata === void 0 ? { allowed: true } : { allowed: true, metadata };
  }
};
var str = (value) => typeof value === "string" || typeof value === "number" ? String(value) : "";
var name = (slot) => typeof slot === "object" && slot !== null && typeof slot.name === "string" ? slot.name : "";

// src/shared/clone.ts
var cloneJson = (value) => value === void 0 ? value : JSON.parse(JSON.stringify(value));

// src/server/items/metadata.ts
var letters = (ctx, n) => {
  let out = "";
  do {
    out = "";
    for (let i = 0; i < n; i++) out += String.fromCharCode(65 + Math.floor(ctx.random() * 26));
  } while (out === "POL" || out === "EMS");
  return out;
};
var digits = (ctx) => String(1e5 + Math.floor(ctx.random() * 9e5));
function generateSerial(ctx, prefix) {
  if (typeof prefix === "string" && prefix.length > 3) return prefix;
  return `${digits(ctx)}${typeof prefix === "string" ? prefix : letters(ctx, 3)}${digits(ctx)}`;
}
function applyDurability(def, metadata, ctx) {
  if (def.degrade) {
    metadata.durability = ctx.now + def.degrade * 60;
    metadata.degrade = def.degrade;
  } else if (def.weapon) {
    metadata.durability = 100;
  }
}
function createMetadata(def, base, ctx) {
  const metadata = base ? cloneJson(base) : {};
  if (typeof metadata.durability !== "number") applyDurability(def, metadata, ctx);
  if (def.weapon) {
    if (def.weapon.ammoName && typeof metadata.ammo !== "number") metadata.ammo = 0;
    if (!Array.isArray(metadata.components)) metadata.components = [];
    if (metadata.registered !== false && (typeof metadata.ammo === "number" || def.name === "WEAPON_STUNGUN")) {
      const registered = typeof metadata.registered === "string" ? metadata.registered : ctx.playerName;
      if (registered) metadata.registered = registered;
      metadata.serial = generateSerial(ctx, metadata.serial);
    }
    if (def.weapon.throwable) delete metadata.serial;
    if (FUEL_LIKE_WEAPONS.includes(def.name)) metadata.ammo = metadata.durability ?? 100;
  }
  return metadata;
}
function checkMetadata(registry, def, metadata, ctx) {
  const durability = metadata.durability;
  if (typeof durability === "number") {
    if (durability < 0 || durability > 100 && ctx.now >= durability) metadata.durability = 0;
  }
  if (def.weapon) {
    const components2 = metadata.components;
    if (components2 !== void 0) {
      const list = Array.isArray(components2) ? components2 : typeof components2 === "object" && components2 ? Object.values(components2) : [];
      metadata.components = list.filter((c) => typeof c === "string" && registry.has(c));
    }
    if (def.weapon.throwable) delete metadata.serial;
    if (metadata.specialAmmo !== void 0 && typeof metadata.specialAmmo !== "string") delete metadata.specialAmmo;
  }
  return metadata;
}
function durabilityPercent(metadata, now) {
  const durability = metadata?.durability;
  if (typeof durability !== "number") return null;
  if (durability <= 100) return Math.max(0, durability);
  const degrade = typeof metadata?.degrade === "number" ? metadata.degrade * 60 : 0;
  if (degrade <= 0) return now >= durability ? 0 : 100;
  return Math.max(0, Math.min(100, (durability - now) / degrade * 100));
}
function slotWeight(registry, def, item, perUnit = false) {
  const count = perUnit ? 1 : item.count;
  const metadata = item.metadata;
  let weight = def.weight * count;
  if (!metadata) return weight;
  if (def.weapon?.ammoName && typeof metadata.ammo === "number") {
    const ammo = registry.get(def.weapon.ammoName);
    if (ammo) weight += ammo.weight * metadata.ammo;
  }
  if (Array.isArray(metadata.components)) {
    for (const component of metadata.components) {
      if (typeof component !== "string") continue;
      const comp = registry.get(component);
      if (comp) weight += comp.weight;
    }
  }
  if (typeof metadata.weight === "number" && metadata.weight > 0) weight += metadata.weight * count;
  return weight;
}
function sameMetadata(a, b) {
  return deepEqual(a ?? {}, b ?? {});
}
function metadataMatches(metadata, query, strict) {
  if (!query) return true;
  if (strict) return sameMetadata(metadata, query);
  const source2 = metadata ?? {};
  for (const [key, value] of Object.entries(query)) {
    if (!deepEqual(source2[key], value)) return false;
  }
  return true;
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b;
    if (a.length !== other.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], other[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// src/server/inventory/ops.ts
var fail = (error) => ({ ok: false, error });
var isCount2 = (n) => Number.isInteger(n) && n >= 1 && n <= LIMITS.count;
function apply(inv, plan) {
  for (const [slot, item] of plan) inv.put(slot, item);
}
function findSlots(inv, name2, query = {}) {
  const out = [];
  for (const slot of inv.sortedSlots()) {
    const item = inv.get(slot);
    if (item.name === name2 && metadataMatches(item.metadata, query.metadata, query.strict === true)) out.push(slot);
  }
  return out;
}
function getItemCount(inv, name2, query = {}) {
  let total = 0;
  for (const slot of findSlots(inv, name2, query)) total += inv.get(slot).count;
  return total;
}
function planAdd(registry, inv, name2, count, opts) {
  const def = registry.get(name2);
  if (!def) return fail("not_found");
  if (!isCount2(count)) return fail("invalid");
  if (opts.slot !== void 0 && (!Number.isInteger(opts.slot) || opts.slot < 1 || opts.slot > inv.slots)) return fail("invalid");
  if (def.stack) {
    const metadata = createMetadata(def, opts.metadata, opts.ctx);
    const added = slotWeight(registry, def, { count, metadata });
    if (!opts.ignoreWeight && added > inv.freeWeight()) return fail("overweight");
    let slot = opts.slot;
    if (slot !== void 0) {
      const current2 = inv.get(slot);
      if (current2 && (current2.name !== def.name || !sameMetadata(current2.metadata, metadata))) return fail("no_slot");
    } else {
      slot = findSlots(inv, def.name, { metadata, strict: true })[0] ?? inv.firstEmptySlot();
    }
    if (slot === void 0) return fail("no_slot");
    const current = inv.get(slot);
    const total = (current?.count ?? 0) + count;
    if (total > LIMITS.count) return fail("invalid");
    return { ok: true, plan: [[slot, { name: def.name, count: total, metadata: current ? current.metadata : metadata }]], slots: [slot] };
  }
  if (count > inv.slots) return fail("no_slot");
  const plan = [];
  const slots = [];
  let weight = 0;
  let next = 1;
  for (let i = 0; i < count; i++) {
    let slot;
    if (i === 0 && opts.slot !== void 0) {
      if (inv.get(opts.slot)) return fail("no_slot");
      slot = opts.slot;
    } else {
      do {
        slot = inv.firstEmptySlot(next);
        if (slot !== void 0) next = slot + 1;
      } while (slot !== void 0 && slots.includes(slot));
    }
    if (slot === void 0) return fail("no_slot");
    const metadata = createMetadata(def, opts.metadata, opts.ctx);
    weight += slotWeight(registry, def, { count: 1, metadata });
    plan.push([slot, { name: def.name, count: 1, metadata }]);
    slots.push(slot);
  }
  if (!opts.ignoreWeight && weight > inv.freeWeight()) return fail("overweight");
  return { ok: true, plan, slots };
}
function addItem(registry, inv, name2, count, opts) {
  const planned = planAdd(registry, inv, name2, count, opts);
  if (!planned.ok) return planned;
  apply(inv, planned.plan);
  return { ok: true, slots: planned.slots };
}
function canCarry(registry, inv, name2, count, metadata) {
  const ctx = { now: 0, random: () => 0.5 };
  const planned = planAdd(registry, inv, name2, count, metadata ? { metadata, ctx } : { ctx });
  return planned.ok ? { ok: true } : planned;
}
function removeItem(inv, name2, count, opts = {}) {
  if (!isCount2(count)) return fail("invalid");
  const candidates = opts.slot !== void 0 ? inv.get(opts.slot)?.name === name2 && metadataMatches(inv.get(opts.slot).metadata, opts.metadata, opts.strict === true) ? [opts.slot] : [] : findSlots(inv, name2, opts);
  let available = 0;
  for (const slot of candidates) available += inv.get(slot).count;
  if (available < count) return fail(candidates.length === 0 ? "not_found" : "not_enough");
  const plan = [];
  let left = count;
  for (const slot of candidates) {
    if (left === 0) break;
    const item = inv.get(slot);
    const take = Math.min(left, item.count);
    plan.push([slot, take === item.count ? null : { ...item, count: item.count - take }]);
    left -= take;
  }
  apply(inv, plan);
  return { ok: true, slots: plan.map(([slot]) => slot) };
}
function setItemCount(registry, inv, name2, count, ctx) {
  if (!Number.isInteger(count) || count < 0 || count > LIMITS.count) return fail("invalid");
  const current = getItemCount(inv, name2);
  if (count > current) {
    const added = addItem(registry, inv, name2, count - current, { ctx, ignoreWeight: true });
    return added.ok ? { ok: true } : added;
  }
  if (count < current) {
    const removed = removeItem(inv, name2, current - count);
    return removed.ok ? { ok: true } : removed;
  }
  return { ok: true };
}
function moveItem(registry, from, fromSlot, to, toSlot, count) {
  if (!isCount2(count)) return fail("invalid");
  if (toSlot < 1 || toSlot > to.slots || fromSlot < 1 || fromSlot > from.slots) return fail("invalid");
  const sameInventory = from === to;
  if (sameInventory && fromSlot === toSlot) return fail("invalid");
  const src = from.get(fromSlot);
  if (!src) return fail("not_found");
  if (count > src.count) return fail("not_enough");
  const def = registry.get(src.name);
  if (!def) return fail("not_found");
  const dst = to.get(toSlot);
  const rest = count === src.count ? null : { ...src, count: src.count - count };
  if (!dst || dst.name === src.name && def.stack && sameMetadata(dst.metadata, src.metadata)) {
    if (!sameInventory) {
      const incoming = slotWeight(registry, def, { count, metadata: src.metadata });
      if (incoming > to.freeWeight()) return fail("overweight");
    }
    const moved = dst ? { ...dst, count: dst.count + count } : { name: src.name, count, metadata: rest ? cloneJson(src.metadata) : src.metadata };
    if (moved.count > LIMITS.count) return fail("invalid");
    from.put(fromSlot, rest);
    to.put(toSlot, moved);
    return { ok: true };
  }
  if (rest) return fail("invalid");
  if (!sameInventory) {
    const srcWeight = from.weightOf(src);
    const dstWeight = to.weightOf(dst);
    if (to.weight - dstWeight + srcWeight > to.maxWeight) return fail("overweight");
    if (from.weight - srcWeight + dstWeight > from.maxWeight) return fail("overweight");
  }
  from.put(fromSlot, dst);
  to.put(toSlot, src);
  return { ok: true };
}
function setMetadata(inv, slot, metadata) {
  const item = inv.get(slot);
  if (!item) return fail("not_found");
  inv.put(slot, { ...item, metadata });
  return { ok: true };
}
function setDurability(inv, slot, durability) {
  const item = inv.get(slot);
  if (!item) return fail("not_found");
  if (!Number.isFinite(durability)) return fail("invalid");
  inv.put(slot, { ...item, metadata: { ...item.metadata, durability: Math.max(0, durability) } });
  return { ok: true };
}
function clearInventory(inv, keep = []) {
  for (const slot of inv.sortedSlots()) {
    if (!keep.includes(inv.get(slot).name)) inv.put(slot, null);
  }
}

// src/server/api/server-api.ts
var fail2 = (error) => ({ ok: false, error });
var ServerApi = class {
  deps;
  constructor(deps) {
    this.deps = deps;
  }
  get manager() {
    return this.deps.service.manager;
  }
  // --- Resolución --------------------------------------------------------------
  /** Inventario por referencia; carga alijos registrados si hace falta. */
  resolve(ref) {
    if (typeof ref === "number") return Number.isInteger(ref) ? this.manager.get(ref) : void 0;
    let id;
    let owner;
    if (typeof ref === "string") {
      id = ref;
    } else if (isRecord(ref) && typeof ref.id === "string") {
      id = ref.id;
      if (ref.owner !== void 0 && ref.owner !== null) owner = String(ref.owner);
    } else {
      return void 0;
    }
    if (!INV_ID.test(id)) return void 0;
    const loaded = this.manager.get(owner ? `${id}:${owner}` : id);
    if (loaded) return loaded;
    if (/^\d+$/.test(id)) return this.manager.get(Number(id));
    const def = this.manager.getStashDef(id);
    if (!def) return void 0;
    return this.manager.loadStash(def, owner).catch((err) => {
      this.deps.log.warn(`no se pudo cargar el alijo ${id}: ${err instanceof Error ? err.message : String(err)}`);
      return void 0;
    });
  }
  with(ref, fallback, fn) {
    const inv = this.resolve(ref);
    if (isPromise(inv)) return inv.then((loaded) => loaded ? fn(loaded) : fallback);
    return inv ? fn(inv) : fallback;
  }
  metadata(value, caller) {
    if (value === void 0 || value === null) return void 0;
    if (typeof value === "string") return { type: value };
    const clean = sanitizeMetadata(value);
    if (!clean) this.deps.log.warn(`${caller}: metadatos no v\xE1lidos de ${invoker() || "?"}`);
    return clean;
  }
  /** Nombre con el que se guarda el objeto (mayúsculas de armas, alias como cash → money). */
  canonical(name2) {
    return this.manager.registry.get(name2)?.name ?? normalizeItemName(name2);
  }
  changed(inv) {
    this.deps.service.afterChange([inv]);
  }
  // --- Objetos -----------------------------------------------------------------
  getItemDef(name2) {
    return typeof name2 === "string" ? this.manager.registry.get(name2) : void 0;
  }
  getItemDefs() {
    const out = {};
    for (const def of this.manager.registry.all()) out[def.name] = def;
    return out;
  }
  registerItem(name2, config) {
    if (typeof name2 !== "string" || !isRecord(config)) return fail2("invalid");
    return { ok: true, item: this.manager.registry.register(name2, config) };
  }
  // --- Añadir y quitar ---------------------------------------------------------
  addItem(ref, name2, count, metadata, slot) {
    const meta = this.metadata(metadata, "addItem");
    if (meta === null) return fail2("invalid");
    if (typeof name2 !== "string") return fail2("invalid");
    return this.with(ref, fail2("not_found"), (inv) => {
      const def = this.manager.registry.get(name2);
      if (!def) return fail2("not_found");
      let finalMeta = meta;
      const hook = this.deps.hooks.trigger("createItem", {
        inventoryId: inv.player ?? inv.id,
        metadata: meta ?? {},
        item: { name: def.name, label: def.label },
        count,
        resource: invoker()
      });
      if (hook.metadata !== void 0) finalMeta = sanitizeMetadata(hook.metadata) ?? finalMeta;
      const info = inv.player !== void 0 ? this.deps.service.playerInfo(inv.player) : void 0;
      const opts = { ctx: this.manager.metaContext(info?.name) };
      if (finalMeta) opts.metadata = finalMeta;
      if (slot !== void 0) opts.slot = slot;
      const result = addItem(this.manager.registry, inv, def.name, count, opts);
      if (result.ok) this.changed(inv);
      return result;
    });
  }
  removeItem(ref, name2, count, metadata, slot, strict) {
    const meta = this.metadata(metadata, "removeItem");
    if (meta === null || typeof name2 !== "string") return fail2("invalid");
    return this.with(ref, fail2("not_found"), (inv) => {
      const opts = { strict: strict === true };
      if (meta) opts.metadata = meta;
      if (slot !== void 0) opts.slot = slot;
      const result = removeItem(inv, this.canonical(name2), count, opts);
      if (result.ok) this.changed(inv);
      return result;
    });
  }
  /** Deja exactamente `count` unidades (lo usa qbx_core para el dinero). */
  setItem(ref, name2, count) {
    if (typeof name2 !== "string") return fail2("invalid");
    return this.with(ref, fail2("not_found"), (inv) => {
      const result = setItemCount(this.manager.registry, inv, this.canonical(name2), count, this.manager.metaContext());
      if (result.ok && inv.hasChanges()) this.changed(inv);
      return result;
    });
  }
  canCarry(ref, name2, count, metadata) {
    const meta = this.metadata(metadata, "canCarry");
    if (meta === null || typeof name2 !== "string") return false;
    return this.with(ref, false, (inv) => canCarry(this.manager.registry, inv, name2, count, meta ?? void 0).ok);
  }
  clearInventory(ref, keep) {
    const list = typeof keep === "string" ? [keep] : Array.isArray(keep) ? keep.filter((k) => typeof k === "string") : [];
    return this.with(ref, false, (inv) => {
      clearInventory(inv, list.map((k) => this.canonical(k)));
      if (inv.hasChanges()) this.changed(inv);
      return true;
    });
  }
  // --- Consultas ---------------------------------------------------------------
  getItemCount(ref, name2, metadata, strict) {
    const meta = this.metadata(metadata, "getItemCount");
    if (meta === null || typeof name2 !== "string") return 0;
    return this.with(ref, 0, (inv) => getItemCount(inv, this.canonical(name2), meta ? { metadata: meta, strict: strict === true } : {}));
  }
  /**
   * Search de ox: 'count' → número (o { nombre: número } si se piden varios);
   * 'slots' → casillas (o { nombre: casillas[] }).
   */
  search(ref, mode, names, metadata) {
    if (mode !== "count" && mode !== "slots") return false;
    const meta = this.metadata(metadata, "search");
    if (meta === null) return false;
    const list = (typeof names === "string" ? [names] : Array.isArray(names) ? names : []).filter((n) => typeof n === "string");
    if (list.length === 0) return false;
    return this.with(ref, false, (inv) => {
      const query = meta ? { metadata: meta } : {};
      const result = {};
      for (const raw of list) {
        const name2 = this.canonical(raw);
        result[raw] = mode === "count" ? getItemCount(inv, name2, query) : findSlots(inv, name2, query).map((slot) => inv.slotView(slot));
      }
      return typeof names === "string" ? result[names] : result;
    });
  }
  getSlot(ref, slot) {
    return this.with(ref, null, (inv) => {
      const view = Number.isInteger(slot) ? inv.slotView(slot) : null;
      return view && view.name !== "" ? view : null;
    });
  }
  getInventory(ref) {
    return this.with(ref, null, (inv) => inv.view());
  }
  // --- Metadatos ---------------------------------------------------------------
  setMetadata(ref, slot, metadata) {
    const meta = sanitizeMetadata(metadata);
    if (!meta || !Number.isInteger(slot)) return fail2("invalid");
    return this.with(ref, fail2("not_found"), (inv) => {
      const result = setMetadata(inv, slot, meta);
      if (result.ok) this.changed(inv);
      return result;
    });
  }
  setDurability(ref, slot, durability) {
    if (!Number.isInteger(slot) || typeof durability !== "number") return fail2("invalid");
    return this.with(ref, fail2("not_found"), (inv) => {
      const result = setDurability(inv, slot, durability);
      if (result.ok) this.changed(inv);
      return result;
    });
  }
  // --- Alijos y hooks ----------------------------------------------------------
  registerStash(def) {
    if (!isRecord(def) || typeof def.name !== "string" || !INV_ID.test(def.name)) return fail2("invalid");
    const stash = {
      name: def.name,
      label: typeof def.label === "string" ? def.label : def.name,
      slots: typeof def.slots === "number" && def.slots >= 1 && def.slots <= 500 ? Math.floor(def.slots) : 50,
      maxWeight: typeof def.maxWeight === "number" && def.maxWeight >= 0 ? def.maxWeight : 1e5
    };
    if (def.owner === true || typeof def.owner === "string") stash.owner = def.owner;
    if (isRecord(def.groups)) stash.groups = def.groups;
    if (Array.isArray(def.coords) && def.coords.length >= 3 && def.coords.slice(0, 3).every((n) => typeof n === "number")) {
      stash.coords = [def.coords[0], def.coords[1], def.coords[2]];
    }
    if (typeof def.distance === "number") stash.distance = def.distance;
    this.manager.registerStash(stash);
    return { ok: true };
  }
  /** Abre a un jugador un inventario sin comprobaciones (registro policial, admin…). */
  openFor(source2, ref) {
    if (!Number.isInteger(source2)) return false;
    return this.with(ref, false, (inv) => this.deps.service.forceOpen(source2, inv));
  }
  registerHook(event, fn, options) {
    if (!HOOK_EVENTS.includes(event) || typeof fn !== "function") return false;
    return this.deps.hooks.register(invoker() || "nx_inventory", event, fn, isRecord(options) ? options : {});
  }
  removeHooks(id) {
    this.deps.hooks.remove(invoker() || "nx_inventory", typeof id === "number" ? id : void 0);
  }
};
function isPromise(value) {
  return typeof value?.then === "function";
}
function invoker() {
  const native = globalThis.GetInvokingResource;
  return (typeof native === "function" ? native() : void 0) ?? "";
}

// src/shared/jsonc.ts
var JsoncError = class extends Error {
  line;
  column;
  constructor(message, line, column) {
    super(`${message} (l\xEDnea ${line}, columna ${column})`);
    this.name = "JsoncError";
    this.line = line;
    this.column = column;
  }
};
function position(text2, index) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index && i < text2.length; i++) {
    if (text2[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return [line, column];
}
function stripJsonc(text2) {
  let out = "";
  let i = 0;
  while (i < text2.length) {
    const ch = text2[i];
    const next = text2[i + 1];
    if (ch === '"') {
      const start2 = i;
      i++;
      while (i < text2.length && text2[i] !== '"') {
        if (text2[i] === "\\") i++;
        if (text2[i] === "\n") {
          const [line, column] = position(text2, start2);
          throw new JsoncError("cadena sin cerrar", line, column);
        }
        i++;
      }
      if (i >= text2.length) {
        const [line, column] = position(text2, start2);
        throw new JsoncError("cadena sin cerrar", line, column);
      }
      out += text2.slice(start2, i + 1);
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text2.length && text2[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      const start2 = i;
      const end = text2.indexOf("*/", i + 2);
      if (end === -1) {
        const [line, column] = position(text2, start2);
        throw new JsoncError("comentario sin cerrar", line, column);
      }
      for (; i < end + 2; i++) out += text2[i] === "\n" ? "\n" : " ";
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      for (; ; ) {
        while (j < text2.length && /\s/.test(text2[j])) j++;
        if (text2[j] === "/" && text2[j + 1] === "/") {
          while (j < text2.length && text2[j] !== "\n") j++;
        } else if (text2[j] === "/" && text2[j + 1] === "*") {
          const end = text2.indexOf("*/", j + 2);
          j = end === -1 ? text2.length : end + 2;
        } else {
          break;
        }
      }
      if (text2[j] === "}" || text2[j] === "]") {
        out += " ";
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}
function parseJsonc(text2) {
  const clean = stripJsonc(text2.charCodeAt(0) === 65279 ? text2.slice(1) : text2);
  try {
    return JSON.parse(clean);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const match = /position (\d+)/.exec(message);
    const [line, column] = match ? position(clean, Number(match[1])) : [0, 0];
    throw new JsoncError(message.replace(/ in JSON at position \d+.*$/, ""), line, column);
  }
}

// src/shared/locale.ts
var LOCALE_CONVARS = ["nx_inventory:locale", "ox:locale"];
var locale = {};
var t = (key, fallback) => locale[key] ?? fallback;
var readTexts = (read, lang) => {
  const content = read(`locales/${lang}.json`);
  if (content === null) return null;
  try {
    return parseJsonc(content);
  } catch {
    return null;
  }
};
function loadLocale(read, wanted) {
  const lang = /^[a-z]{2}(-[a-z]{2})?$/i.test(wanted) ? wanted.toLowerCase() : "en";
  for (const key of Object.keys(locale)) delete locale[key];
  Object.assign(locale, readTexts(read, "en") ?? {});
  if (lang === "en") return "en";
  const texts2 = readTexts(read, lang);
  if (!texts2) return "en";
  Object.assign(locale, texts2);
  return lang;
}

// src/server/compat/ox.ts
var then = (value, fn) => typeof value?.then === "function" ? value.then(fn) : fn(value);
function toVec3(value) {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((n) => typeof n === "number")) return [value[0], value[1], value[2]];
  if (typeof value === "object" && value !== null) {
    const { x, y, z } = value;
    if (typeof x === "number" && typeof y === "number" && typeof z === "number") return [x, y, z];
  }
  return void 0;
}
function registerOxCompat(deps) {
  const { api, service } = deps;
  const registry = service.manager.registry;
  const ref = (inv, owner) => {
    if (typeof inv === "number") return inv;
    if (typeof inv === "string") return owner !== void 0 && owner !== null && owner !== false ? { id: inv, owner: String(owner) } : inv;
    if (typeof inv === "object" && inv !== null) {
      const { id, owner: own } = inv;
      if (typeof id === "number") return id;
      if (typeof id === "string") return own !== void 0 && own !== null && own !== false ? { id, owner: String(own) } : id;
    }
    return void 0;
  };
  const oxItem = (name2) => {
    const def = registry.get(name2);
    if (!def) return void 0;
    return {
      name: def.name,
      label: def.label,
      weight: def.weight,
      stack: def.stack,
      close: def.close,
      description: def.description,
      consume: def.consume,
      weapon: def.weapon ? true : void 0,
      ammoname: def.weapon?.ammoName,
      ammo: def.ammo,
      component: def.component ? true : void 0,
      type: def.component?.type,
      degrade: def.degrade,
      durability: def.weapon?.durability,
      client: def.image ? { image: `${def.image}.png` } : void 0
    };
  };
  const oxSlot = (view) => {
    if (!view || !view.name) return void 0;
    const def = registry.get(view.name);
    return {
      name: view.name,
      label: (typeof view.metadata?.label === "string" ? view.metadata.label : void 0) ?? def?.label ?? view.name,
      weight: view.weight,
      slot: view.slot,
      count: view.count,
      metadata: view.metadata ?? {},
      stack: def?.stack ?? true,
      close: def?.close ?? true,
      description: def?.description
    };
  };
  const slotMap = (inv) => {
    const out = [];
    for (const [slot] of inv.entries()) out[slot - 1] = oxSlot(inv.slotView(slot));
    for (let i = 0; i < out.length; i++) if (out[i] === void 0) out[i] = null;
    return out;
  };
  const resolve = (inv, owner) => {
    const r = ref(inv, owner);
    return r === void 0 ? void 0 : api.resolve(r);
  };
  const exportsOx = {
    Items: (name2) => {
      if (typeof name2 === "string") return oxItem(name2);
      const all2 = {};
      for (const def of registry.all()) all2[def.name] = oxItem(def.name);
      return all2;
    },
    AddItem: (inv, item, count, metadata, slot, cb) => {
      const r = ref(inv);
      if (r === void 0) return false;
      return then(api.addItem(r, item, Math.floor(Number(count) || 0), metadata ?? void 0, typeof slot === "number" ? slot : void 0), (result) => {
        if (typeof cb === "function") cb(result.ok, result.ok ? void 0 : result.error);
        return result.ok;
      });
    },
    RemoveItem: (inv, item, count, metadata, slot, _ignoreTotal, strict) => {
      const r = ref(inv);
      if (r === void 0) return false;
      return then(api.removeItem(r, item, Math.floor(Number(count) || 0), metadata ?? void 0, typeof slot === "number" ? slot : void 0, strict === true), (result) => result.ok);
    },
    SetItem: (inv, item, count) => {
      const r = ref(inv);
      return r === void 0 ? false : then(api.setItem(r, item, Math.floor(Number(count) || 0)), (result) => result.ok);
    },
    GetItemCount: (inv, item, metadata, strict) => {
      const r = ref(inv);
      return r === void 0 ? 0 : api.getItemCount(r, item, metadata ?? void 0, strict === true);
    },
    CanCarryItem: (inv, item, count, metadata) => {
      const r = ref(inv);
      return r === void 0 ? false : api.canCarry(r, item, Math.floor(Number(count) || 0), metadata ?? void 0);
    },
    Search: (inv, search, items, metadata) => {
      const r = ref(inv);
      if (r === void 0) return false;
      const mode = search === 1 || search === "slots" ? "slots" : "count";
      return then(api.search(r, mode, items, metadata ?? void 0), (result) => {
        if (mode === "count" || result === false) return result;
        if (Array.isArray(result)) return result.map((v) => oxSlot(v));
        const out = {};
        for (const [name2, list] of Object.entries(result)) out[name2] = list.map((v) => oxSlot(v));
        return out;
      });
    },
    GetSlot: (inv, slot) => {
      const r = ref(inv);
      return r === void 0 ? void 0 : then(api.getSlot(r, slot), (view) => oxSlot(view));
    },
    GetSlotWithItem: (inv, item, metadata, strict) => {
      const found = resolve(inv);
      return found === void 0 ? void 0 : then(found, (i) => i ? firstSlot(i, item, metadata, strict) : void 0);
    },
    GetSlotsWithItem: (inv, item, metadata, strict) => {
      const found = resolve(inv);
      return found === void 0 ? [] : then(found, (i) => i ? slotsWith(i, item, metadata, strict) : []);
    },
    GetInventory: (inv, owner) => {
      const found = resolve(inv, owner);
      return found === void 0 ? void 0 : then(
        found,
        (i) => i ? { id: i.player ?? i.id, label: i.label, type: i.type, slots: i.slots, weight: i.weight, maxWeight: i.maxWeight, owner: i.owner, items: slotMap(i) } : void 0
      );
    },
    GetInventoryItems: (inv, owner) => {
      const found = resolve(inv, owner);
      return found === void 0 ? void 0 : then(found, (i) => i ? slotMap(i) : void 0);
    },
    ClearInventory: (inv, keep) => {
      const r = ref(inv);
      return r === void 0 ? false : api.clearInventory(r, keep);
    },
    SetDurability: (inv, slot, durability) => {
      const r = ref(inv);
      return r === void 0 ? false : then(api.setDurability(r, slot, durability), (result) => result.ok);
    },
    SetMetadata: (inv, slot, metadata) => {
      const r = ref(inv);
      return r === void 0 ? false : then(api.setMetadata(r, slot, metadata), (result) => result.ok);
    },
    RegisterStash: (name2, label, slots, maxWeight, owner, groups, coords) => {
      const def = { name: name2, label, slots, maxWeight };
      if (owner === true || typeof owner === "string") def.owner = owner;
      if (typeof groups === "object" && groups !== null) def.groups = groupsOf(groups, service.deps.config.policeGroups);
      if (typeof groups === "string") def.groups = { [groups]: 0 };
      const point = toVec3(coords);
      if (point) def.coords = point;
      return api.registerStash(def).ok;
    },
    forceOpenInventory: (playerId, invType, data) => {
      const target = invType === "player" ? typeof data === "number" ? data : Number(data?.id) : data;
      const r = invType === "player" ? Number.isInteger(target) ? target : void 0 : ref(target);
      if (r === void 0) return false;
      return then(api.resolve(r), (inv) => inv ? service.forceOpen(Number(playerId), inv) : false);
    },
    registerHook: (event, fn, options) => api.registerHook(event, fn, options),
    removeHooks: (id) => api.removeHooks(id),
    CustomDrop: (prefix, items, coords, slots, maxWeight, instance, model) => {
      const point = toVec3(coords);
      if (!point || !Array.isArray(items)) return void 0;
      const list = [];
      items.forEach((entry, index) => {
        if (!Array.isArray(entry) || typeof entry[0] !== "string") return;
        const stored = { slot: index + 1, name: entry[0], count: Math.max(1, Math.floor(Number(entry[1]) || 1)) };
        if (typeof entry[2] === "object" && entry[2] !== null) stored.metadata = entry[2];
        list.push(stored);
      });
      return deps.transfer.createDrop(
        typeof prefix === "string" ? prefix : "drop",
        list,
        point,
        typeof instance === "number" ? instance : 0,
        typeof slots === "number" ? slots : void 0,
        typeof maxWeight === "number" ? maxWeight : void 0,
        typeof model === "string" ? model : void 0
      ) ?? void 0;
    },
    CanCarryWeight: (inv, weight) => {
      const found = resolve(inv);
      return found === void 0 ? false : then(found, (i) => !!i && typeof weight === "number" && weight <= i.freeWeight());
    },
    /** Arma en la mano de un jugador (ox_fuel la usa para los bidones). */
    GetCurrentWeapon: (inv) => {
      const source2 = typeof inv === "number" ? inv : Number(inv);
      const slot = service.session(source2)?.weapon;
      const own = service.manager.get(source2);
      return slot === void 0 || !own ? void 0 : oxSlot(own.slotView(slot));
    },
    /** Cárcel (xt-prison): se guarda todo en un alijo con owner = name = citizenid, como ox. */
    ConfiscateInventory: (source2) => then(confiscation(Number(source2)), (pair) => {
      if (!pair) return false;
      const [own, box] = pair;
      for (const slot of own.sortedSlots()) {
        box.put(slot, own.get(slot));
        own.put(slot, null);
      }
      const session = service.session(Number(source2));
      if (session) delete session.weapon;
      service.afterChange([own, box]);
      void service.manager.save([box]).catch(() => {
      });
      return true;
    }),
    ReturnInventory: (source2) => then(confiscation(Number(source2)), (pair) => {
      if (!pair) return false;
      const [own, box] = pair;
      for (const slot of box.sortedSlots()) {
        const target = own.get(slot) ? own.firstEmptySlot() : slot;
        if (target === void 0) break;
        own.put(target, box.get(slot));
        box.put(slot, null);
      }
      service.afterChange([own, box]);
      void service.manager.save([box]).catch(() => {
      });
      return true;
    }),
    RegisterShop: (name2, data) => {
      const shop = shopFromOx(data, service.deps.config.policeGroups);
      if (!shop || typeof name2 !== "string") return false;
      deps.shops.register(name2, shop);
      return true;
    }
  };
  function confiscation(source2) {
    const own = service.manager.get(source2);
    const owner = own?.owner;
    if (!own || own.type !== "player" || !owner) return null;
    const def = { name: owner, label: t("label_confiscated", "Confiscated"), slots: Math.max(own.slots, 1), maxWeight: 1e8, owner };
    return service.manager.loadStash(def, owner).then((box) => [own, box]).catch(() => null);
  }
  const firstSlot = (inv, item, metadata, strict) => slotsWith(inv, item, metadata, strict)[0];
  function slotsWith(inv, item, metadata, strict) {
    const result = api.search(inv.player ?? inv.id, "slots", item, metadata);
    const views = Array.isArray(result) ? result : [];
    return views.filter((v) => !strict || !metadata || JSON.stringify(v.metadata ?? {}) === JSON.stringify(metadata)).map((v) => oxSlot(v));
  }
  for (const [name2, fn] of Object.entries(exportsOx)) {
    deps.on(`__cfx_export_ox_inventory_${name2}`, ((setCB) => setCB(fn)));
  }
}
function groupsOf(groups, police) {
  if (Array.isArray(groups)) return Object.fromEntries(groups.filter((g) => typeof g === "string").map((g) => [g, 0]));
  const out = {};
  for (const [group, grade] of Object.entries(groups)) out[group] = typeof grade === "number" ? grade : 0;
  return Object.keys(out).length ? out : Object.fromEntries(police.map((g) => [g, 0]));
}
function shopFromOx(data, police) {
  if (typeof data !== "object" || data === null) return null;
  const d = data;
  if (!Array.isArray(d.inventory)) return null;
  const shop = {
    label: typeof d.name === "string" ? d.name : t("label_shop", "Shop"),
    items: d.inventory.filter((i) => typeof i === "object" && i !== null && typeof i.name === "string").map((i) => ({
      name: i.name,
      price: typeof i.price === "number" ? i.price : 0,
      ...typeof i.currency === "string" ? { currency: i.currency } : {},
      ...typeof i.count === "number" ? { count: i.count } : {},
      ...typeof i.license === "string" ? { license: i.license } : {},
      ...typeof i.grade === "number" || Array.isArray(i.grade) ? { grade: i.grade } : {},
      ...typeof i.metadata === "object" && i.metadata !== null ? { metadata: i.metadata } : {}
    }))
  };
  if (typeof d.groups === "object" && d.groups !== null) shop.groups = groupsOf(d.groups, police);
  if (Array.isArray(d.locations)) shop.locations = d.locations.map(toVec3).filter((v) => !!v);
  if (Array.isArray(d.targets)) {
    shop.targets = d.targets.map((t2) => toVec3(t2?.loc ?? t2?.coords)).filter((v) => !!v).map((coords) => ({ coords }));
  }
  if (Array.isArray(d.model)) shop.models = d.model.filter((m) => typeof m === "string" || typeof m === "number");
  return shop;
}

// src/server/core/config.ts
var DEFAULT_CONFIG = {
  playerSlots: 50,
  playerMaxWeight: 85e3,
  policeGroups: ["police"],
  authorizedGroups: [],
  authorizeGangs: true,
  stashDistance: 3,
  distanceTolerance: 2,
  saveInterval: 60,
  stashIdleMinutes: 10,
  frameworkSyncDelay: 250,
  imagePath: "nui://nx_inventory/web/images",
  imageExt: "webp",
  logLevel: "info",
  giveDistance: 3,
  searchDistance: 2.5,
  dropSlots: 50,
  dropMaxWeight: 3e4,
  dropMergeDistance: 1.5,
  dropModel: "prop_med_bag_01b",
  trimPlate: true,
  vehicleLoot: [],
  hotbarSlots: 5,
  keys: { inventory: "TAB", secondary: "K", hotbar: "F1", reload: "R" },
  enableControls: [249],
  weaponAnims: true,
  weaponNotify: true,
  itemNotify: true,
  aimedFiring: false,
  autoReload: false,
  integrations: {
    notify: "",
    progress: "",
    textUiShow: "",
    textUiHide: "",
    escortResource: "",
    escortWarpEvent: "",
    escortRemoveEvent: "",
    restrainedStates: ["isHandcuffed", "handcuffed", "isDead", "isLaststand"],
    personalActionEvent: "nx_inventory:personalAction"
  }
};
var number = (min, max) => (v) => typeof v === "number" && v >= min && v <= max ? v : void 0;
var integer = (min, max) => (v) => Number.isInteger(v) && v >= min && v <= max ? v : void 0;
var boolean = (v) => typeof v === "boolean" ? v : void 0;
var text = (v) => typeof v === "string" && v.length > 0 ? v : void 0;
var oneOf = (...values) => (v) => typeof v === "string" && values.includes(v) ? v : void 0;
var texts = (v) => Array.isArray(v) && v.every((s) => typeof s === "string") ? v : void 0;
var integers = (v) => Array.isArray(v) && v.every((n) => Number.isInteger(n)) ? v : void 0;
var RULES = {
  playerSlots: integer(1, 500),
  playerMaxWeight: number(0, 1e8),
  policeGroups: texts,
  authorizedGroups: texts,
  authorizeGangs: boolean,
  stashDistance: number(0.5, 100),
  distanceTolerance: number(0, 20),
  saveInterval: number(5, 3600),
  stashIdleMinutes: number(1, 1440),
  frameworkSyncDelay: number(0, 5e3),
  imagePath: (v) => typeof v === "string" && v.length > 0 ? v.replace(/\/+$/, "") : void 0,
  imageExt: oneOf("png", "webp"),
  logLevel: oneOf("error", "warn", "info"),
  giveDistance: number(0.5, 20),
  searchDistance: number(0.5, 20),
  dropSlots: integer(1, 500),
  dropMaxWeight: number(0, 1e8),
  dropMergeDistance: number(0, 10),
  dropModel: text,
  trimPlate: boolean,
  vehicleLoot: (v) => Array.isArray(v) && v.every(
    (e) => Array.isArray(e) && typeof e[0] === "string" && Number.isInteger(e[1]) && Number.isInteger(e[2]) && (e[3] === void 0 || typeof e[3] === "number")
  ) ? v : void 0,
  hotbarSlots: integer(0, 10),
  keys: (v) => isRecord(v) && ["inventory", "secondary", "hotbar", "reload"].every((k) => typeof v[k] === "string" && v[k] !== "") ? v : void 0,
  enableControls: integers,
  weaponAnims: boolean,
  weaponNotify: boolean,
  itemNotify: boolean,
  aimedFiring: boolean,
  autoReload: boolean,
  // los campos que falten se quedan con el valor por defecto
  integrations: (v) => {
    if (!isRecord(v)) return void 0;
    const out = { ...DEFAULT_CONFIG.integrations };
    for (const [key, value] of Object.entries(v)) {
      if (!(key in out)) return void 0;
      if (key === "restrainedStates") {
        if (!Array.isArray(value) || !value.every((s) => typeof s === "string")) return void 0;
        out.restrainedStates = value;
      } else if (typeof value === "string") out[key] = value;
      else return void 0;
    }
    return out;
  }
};
var ConfigError = class extends Error {
};
function readJsonc(read, path) {
  const content = read(path);
  if (content === null) throw new ConfigError(`falta ${path}`);
  try {
    return parseJsonc(content);
  } catch (err) {
    throw new ConfigError(`${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function parseGeneral(raw, warn) {
  const config = structuredCloneSafe(DEFAULT_CONFIG);
  if (!isRecord(raw)) throw new ConfigError("config/config.jsonc: debe ser un objeto");
  for (const [key, value] of Object.entries(raw)) {
    const rule = RULES[key];
    if (!rule) {
      warn(`config.jsonc: "${key}" no existe, se ignora`);
      continue;
    }
    const clean = rule(value);
    if (clean === void 0) warn(`config.jsonc: "${key}" no es v\xE1lido; se usa ${JSON.stringify(DEFAULT_CONFIG[key])}`);
    else config[key] = clean;
  }
  return config;
}
function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
var vec3 = (value) => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((n) => typeof n === "number") ? [value[0], value[1], value[2]] : void 0;
function parseStashes(raw, police, warn) {
  if (!Array.isArray(raw)) throw new ConfigError("config/stashes.jsonc: debe ser una lista");
  const out = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      warn('stashes.jsonc: entrada sin "name", se ignora');
      continue;
    }
    const def = {
      name: entry.name,
      label: typeof entry.label === "string" ? entry.label : entry.name,
      slots: typeof entry.slots === "number" ? Math.floor(entry.slots) : 50,
      maxWeight: typeof entry.maxWeight === "number" ? entry.maxWeight : 1e5
    };
    if (entry.owner === true || typeof entry.owner === "string") def.owner = entry.owner;
    if (entry.groups === "police") def.groups = Object.fromEntries(police.map((g) => [g, 0]));
    else if (isRecord(entry.groups)) def.groups = entry.groups;
    const coords = vec3(entry.coords);
    if (coords) def.coords = coords;
    if (typeof entry.distance === "number") def.distance = entry.distance;
    out.push(def);
  }
  return out;
}
function parseShops(raw, warn) {
  if (!isRecord(raw)) throw new ConfigError("config/shops.jsonc: debe ser un objeto tipo \u2192 tienda");
  const out = {};
  for (const [type, entry] of Object.entries(raw)) {
    if (!isRecord(entry) || !Array.isArray(entry.items) || !/^[\w-]{1,40}$/.test(type)) {
      warn(`shops.jsonc: "${type}" sin "items" o con nombre no v\xE1lido, se ignora`);
      continue;
    }
    const shop = {
      label: typeof entry.label === "string" ? entry.label : type,
      items: entry.items.filter(
        (i) => isRecord(i) && typeof i.name === "string" && typeof i.price === "number" && i.price >= 0
      )
    };
    if (isRecord(entry.groups)) shop.groups = entry.groups;
    if (Array.isArray(entry.locations)) shop.locations = entry.locations.map(vec3).filter((v) => !!v);
    if (Array.isArray(entry.targets)) {
      shop.targets = entry.targets.map((t2) => isRecord(t2) ? vec3(t2.coords) : void 0).filter((v) => !!v).map((coords) => ({ coords }));
    }
    if (Array.isArray(entry.models)) shop.models = entry.models.filter((m) => typeof m === "string" || typeof m === "number");
    if (isRecord(entry.blip)) shop.blip = entry.blip;
    out[type] = shop;
  }
  return out;
}
function loadConfig(read, warn) {
  const general = parseGeneral(readJsonc(read, "config/config.jsonc"), warn);
  const items = readJsonc(read, "config/items.jsonc");
  const weapons = readJsonc(read, "config/weapons.jsonc");
  const animations = readJsonc(read, "config/animations.jsonc");
  const vehicles = readJsonc(read, "config/vehicles.jsonc");
  if (!isRecord(items)) throw new ConfigError("config/items.jsonc: debe ser un objeto nombre \u2192 objeto");
  if (!isRecord(weapons) || !isRecord(weapons.weapons) || !isRecord(weapons.components) || !isRecord(weapons.ammo)) {
    throw new ConfigError('config/weapons.jsonc: debe tener "weapons", "components" y "ammo"');
  }
  if (!isRecord(animations) || !isRecord(animations.anim) || !isRecord(animations.prop)) {
    throw new ConfigError('config/animations.jsonc: debe tener "anim" y "prop"');
  }
  if (!isRecord(vehicles) || !isRecord(vehicles.storage) || !isRecord(vehicles.trunk) || !isRecord(vehicles.glovebox)) {
    throw new ConfigError('config/vehicles.jsonc: debe tener "storage", "trunk" y "glovebox"');
  }
  return {
    general,
    items,
    weapons,
    animations,
    stashes: parseStashes(readJsonc(read, "config/stashes.jsonc"), general.policeGroups, warn),
    shops: parseShops(readJsonc(read, "config/shops.jsonc"), warn),
    vehicles
  };
}

// src/server/core/logger.ts
var LEVELS = { error: 0, warn: 1, info: 2 };
function createLogger(level) {
  const max = LEVELS[level];
  return {
    info: (message) => {
      if (max >= LEVELS.info) console.log(`^5[nx_inventory]^7 ${message}`);
    },
    warn: (message) => {
      if (max >= LEVELS.warn) console.log(`^3[nx_inventory]^7 ${message}`);
    },
    error: (message) => console.log(`^1[nx_inventory] ${message}^7`)
  };
}

// src/server/frameworks/framework.ts
function hasGroup(groups, required) {
  if (!required) return true;
  for (const [group, minGrade] of Object.entries(required)) {
    const grade = groups[group];
    if (grade !== void 0 && grade >= minGrade) return true;
  }
  return false;
}

// src/server/network/rpc.ts
var RpcError = class extends Error {
  code;
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
};
var RateLimiter = class {
  windows = /* @__PURE__ */ new Map();
  limit;
  windowMs;
  constructor(limit, windowMs = 1e3) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  allow(source2, now) {
    let stamps = this.windows.get(source2);
    if (!stamps) {
      stamps = [];
      this.windows.set(source2, stamps);
    }
    while (stamps.length > 0 && now - stamps[0] >= this.windowMs) stamps.shift();
    if (stamps.length >= this.limit) return false;
    stamps.push(now);
    return true;
  }
  forget(source2) {
    this.windows.delete(source2);
  }
};
var RpcServer = class {
  handlers = /* @__PURE__ */ new Map();
  busy = /* @__PURE__ */ new Set();
  limiter;
  transport;
  log;
  /** avisos por jugador, para no inundar el registro si alguien manda basura */
  strikes = /* @__PURE__ */ new Map();
  constructor(transport, log, rate = RPC_RATE) {
    this.transport = transport;
    this.log = log;
    this.limiter = new RateLimiter(rate);
  }
  handle(op, handler, options) {
    this.handlers.set(op, { handler, mutating: options.mutating });
  }
  /** Punto de entrada del evento de red. `raw` viene del cliente: no se fía de nada. */
  async receive(source2, raw) {
    if (!isRecord(raw) || !isInt(raw.id, 0, 2 ** 31 - 1)) {
      this.suspicious(source2, "petici\xF3n sin id");
      return;
    }
    const id = raw.id;
    const reply = (result) => this.transport.reply(source2, result);
    const error = (code) => reply({ id, ok: false, error: code });
    if (!this.limiter.allow(source2, this.transport.now())) {
      this.suspicious(source2, "demasiadas peticiones");
      return error("rate");
    }
    if (!isRpcOp(raw.op)) {
      this.suspicious(source2, `operaci\xF3n desconocida ${String(raw.op).slice(0, 32)}`);
      return error("invalid");
    }
    const op = raw.op;
    const registered = this.handlers.get(op);
    if (!registered) return error("not_found");
    const parsed = parseRpcArgs(op, raw.args);
    if (!parsed.ok) {
      this.suspicious(source2, `argumentos no v\xE1lidos para ${op}`);
      return error("invalid");
    }
    if (registered.mutating) {
      if (this.busy.has(source2)) return error("busy");
      this.busy.add(source2);
    }
    try {
      const data = await registered.handler(source2, parsed.args);
      reply({ id, ok: true, data });
    } catch (err) {
      if (err instanceof RpcError && ERROR_CODES.includes(err.code)) {
        error(err.code);
      } else {
        this.log.error(`rpc ${op} de ${source2}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
        error("internal");
      }
    } finally {
      if (registered.mutating) this.busy.delete(source2);
    }
  }
  /** Al desconectarse un jugador. */
  forget(source2) {
    this.busy.delete(source2);
    this.limiter.forget(source2);
    this.strikes.delete(source2);
  }
  suspicious(source2, reason) {
    const strikes = (this.strikes.get(source2) ?? 0) + 1;
    this.strikes.set(source2, strikes);
    if (strikes <= 5 || strikes % 50 === 0) this.log.warn(`[sospechoso] jugador ${source2}: ${reason} (${strikes})`);
  }
};

// src/server/features/shops.ts
var SHOP_DISTANCE = 3;
function itemLocked(service, source2, shop, item) {
  if (item.count !== void 0 && item.count <= 0) return true;
  if (item.license && !service.deps.framework.hasLicense(source2, item.license)) return true;
  if (item.grade !== void 0 && shop.groups) {
    const groups = service.playerInfo(source2)?.groups ?? {};
    const grades = Object.keys(shop.groups).map((group) => groups[group]).filter((g) => g !== void 0);
    if (Array.isArray(item.grade)) return !grades.some((g) => item.grade.includes(g));
    return !grades.some((g) => g >= item.grade);
  }
  return false;
}
var ShopFeature = class {
  service;
  shops = /* @__PURE__ */ new Map();
  nextView = 1;
  constructor(service) {
    this.service = service;
    service.registerOpener("shop", async (source2, req, session) => {
      const [type, index] = typeof req.id === "string" ? req.id.split(":") : [];
      const shop = type ? this.shops.get(type) : void 0;
      if (!shop || !type) throw new RpcError("not_found");
      if (!hasGroup(session.info.groups, shop.groups)) throw new RpcError("no_access");
      const point = this.pointOf(shop, index, req.coords);
      if (!point) throw new RpcError("invalid");
      const inv = this.buildView(source2, type, shop, point);
      return { inv, check: () => service.near(source2, point, SHOP_DISTANCE) ? null : "too_far" };
    });
    service.onClose((_source, inv) => {
      if (inv.type === "shop") service.manager.remove(inv.id);
    });
  }
  register(type, def) {
    this.shops.set(type, def);
  }
  get(type) {
    return this.shops.get(type);
  }
  all() {
    return this.shops.entries();
  }
  buy(source2, req) {
    const service = this.service;
    const session = service.requireSession(source2);
    const left = service.requirePlayerInventory(source2);
    if (session.right !== req.shop) throw new RpcError("no_access");
    service.checkAccess(source2);
    const view = service.manager.get(req.shop);
    const type = view?.dbId;
    const shop = typeof type === "string" ? this.shops.get(type) : void 0;
    const offer = view?.shopSlots?.get(req.slot);
    const item = shop?.items[req.slot - 1];
    if (!view || !shop || !offer || !item) throw new RpcError("not_found");
    if (itemLocked(service, source2, shop, item)) throw new RpcError("no_access");
    if (item.count !== void 0 && req.count > item.count) throw new RpcError("not_enough");
    const registry = service.manager.registry;
    const def = registry.get(item.name);
    if (!def) throw new RpcError("not_found");
    const count = def.stack ? req.count : 1;
    const currency = item.currency ?? "money";
    const total = item.price * count;
    if (getItemCount(left, currency) < total) throw new RpcError("cannot_afford");
    const metadata = item.metadata ? sanitizeMetadata(item.metadata) ?? void 0 : void 0;
    const fits = canCarry(registry, left, item.name, count, metadata);
    if (!fits.ok) throw new RpcError(fits.error);
    const hook = service.deps.hooks.trigger("buyItem", {
      source: source2,
      shopType: type,
      shopId: req.shop,
      itemName: item.name,
      count,
      price: item.price,
      totalPrice: total,
      currency,
      toSlot: req.toSlot,
      metadata
    });
    if (!hook.allowed) throw new RpcError("hook");
    if (total > 0) {
      const paid = removeItem(left, currency, total);
      if (!paid.ok) throw new RpcError("cannot_afford");
    }
    const opts = { ctx: service.manager.metaContext(session.info.name), ...metadata ? { metadata } : {}, ...req.toSlot !== void 0 && !left.get(req.toSlot) ? { slot: req.toSlot } : {} };
    const added = addItem(registry, left, item.name, count, opts);
    if (!added.ok) {
      if (total > 0) addItem(registry, left, currency, total, { ctx: opts.ctx, ignoreWeight: true });
      service.afterChange([left]);
      throw new RpcError(added.error);
    }
    if (item.count !== void 0) item.count -= count;
    service.afterChange([left]);
    return true;
  }
  pointOf(shop, index, coords) {
    if (index !== void 0 && index !== "") {
      const i = Number(index) - 1;
      return shop.targets?.[i]?.coords ?? shop.locations?.[i] ?? null;
    }
    return shop.models?.length && coords ? coords : null;
  }
  buildView(source2, type, shop, point) {
    const inv = this.service.manager.createTemporary({
      id: `shop-${type.replace(/[^\w-]/g, "").slice(0, 30)}-${this.nextView++}`,
      type: "shop",
      label: shop.label,
      slots: Math.max(1, shop.items.length),
      maxWeight: 0,
      dbId: type,
      coords: point,
      distance: SHOP_DISTANCE
    });
    const registry = this.service.manager.registry;
    const ctx = this.service.manager.metaContext();
    inv.shopSlots = /* @__PURE__ */ new Map();
    shop.items.forEach((item, index) => {
      const slot = index + 1;
      if (!registry.has(item.name)) return;
      const offer = {
        price: item.price,
        currency: item.currency ?? "money"
      };
      if (itemLocked(this.service, source2, shop, item)) offer.locked = true;
      const def = registry.get(item.name);
      const shown = def.stack ? Math.max(1, item.count ?? 1) : 1;
      addItem(registry, inv, item.name, shown, { ctx, slot, ignoreWeight: true, ...item.metadata ? { metadata: item.metadata } : {} });
      inv.shopSlots.set(slot, offer);
    });
    inv.takeChanges();
    return inv;
  }
};

// src/server/inventory/service.ts
var distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
var InventoryService = class {
  deps;
  sessions = /* @__PURE__ */ new Map();
  loading = /* @__PURE__ */ new Set();
  syncTimers = /* @__PURE__ */ new Map();
  openers = /* @__PURE__ */ new Map();
  closeListeners = /* @__PURE__ */ new Set();
  /** evita que el eco del framework (SetMoney → SetItem) vuelva a sincronizar */
  syncing = false;
  constructor(deps) {
    this.deps = deps;
    this.registerOpener("stash", async (source2, req, session) => {
      if (typeof req.id !== "string") throw new RpcError("invalid");
      const def = this.manager.getStashDef(req.id);
      if (!def) throw new RpcError("not_found");
      if (!hasGroup(session.info.groups, def.groups)) throw new RpcError("no_access");
      const inv = await this.manager.loadStash(def, session.info.owner);
      return { inv, check: () => this.placeCheck(source2, inv) };
    });
  }
  get manager() {
    return this.deps.manager;
  }
  isLoaded(source2) {
    return this.sessions.has(source2);
  }
  playerInfo(source2) {
    return this.sessions.get(source2)?.info;
  }
  session(source2) {
    return this.sessions.get(source2);
  }
  isPolice(source2) {
    const groups = this.sessions.get(source2)?.info.groups ?? {};
    return this.deps.config.policeGroups.some((group) => groups[group] !== void 0);
  }
  /** Policía, grupos de authorizedGroups o (con authorizeGangs) cualquier banda u organización. */
  isAuthorized(source2) {
    const groups = this.sessions.get(source2)?.info.groups;
    if (!groups) return false;
    const { config, framework } = this.deps;
    return Object.keys(groups).some(
      (group) => config.policeGroups.includes(group) || config.authorizedGroups.includes(group) || config.authorizeGangs && framework.isGang(group)
    );
  }
  registerOpener(type, opener) {
    this.openers.set(type, opener);
  }
  /** Avisa cuando un jugador cierra un secundario (drops vacíos, maleteros temporales…). */
  onClose(listener) {
    this.closeListeners.add(listener);
  }
  // --- Ciclo de vida -----------------------------------------------------------
  async playerLoaded(info) {
    if (this.loading.has(info.source)) return;
    this.loading.add(info.source);
    const { manager, config, log } = this.deps;
    try {
      if (this.sessions.has(info.source)) await this.playerLogout(info.source);
      const inv = await manager.loadPlayer({
        source: info.source,
        owner: info.owner,
        name: info.name,
        slots: config.playerSlots,
        maxWeight: config.playerMaxWeight
      });
      for (const item of Object.keys(this.deps.framework.accountItems)) {
        const amount = info.accounts[item] ?? 0;
        if (getItemCount(inv, item) !== amount) setItemCount(manager.registry, inv, item, amount, manager.metaContext(info.name));
      }
      inv.takeChanges();
      this.sessions.set(info.source, { info });
      this.deps.sendSetup(info.source, inv.view());
      log.info(`inventario de ${info.name} (${info.owner}) cargado en ${info.source}`);
    } catch (err) {
      log.error(`no se pudo cargar el inventario de ${info.owner}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.loading.delete(info.source);
    }
  }
  async playerLogout(source2) {
    this.closeSecondary(source2, false);
    const own = this.manager.get(source2);
    if (own) for (const viewer of [...own.openedBy]) this.closeSecondary(viewer, true);
    const timer = this.syncTimers.get(source2);
    if (timer) {
      clearTimeout(timer);
      this.syncTimers.delete(source2);
      this.syncFramework(source2);
    }
    this.sessions.delete(source2);
    this.deps.sendLogout(source2);
    await this.manager.unloadPlayer(source2);
  }
  /** El framework cambió una cuenta que va como objeto (efectivo en QBCore): el objeto se pone igual. */
  accountChanged(source2, item, amount) {
    const inv = this.manager.get(source2);
    if (!inv || !this.sessions.has(source2) || !(item in this.deps.framework.accountItems)) return;
    if (getItemCount(inv, item) === amount) return;
    setItemCount(this.manager.registry, inv, item, amount, this.manager.metaContext(this.sessions.get(source2).info.name));
    this.afterChange([inv]);
  }
  groupChanged(source2, group, grade) {
    const session = this.sessions.get(source2);
    if (!session) return;
    if (grade === void 0) delete session.info.groups[group];
    else session.info.groups[group] = grade;
    const right = session.right ? this.manager.get(session.right) : void 0;
    if (right && !session.forced && !hasGroup(session.info.groups, right.groups)) this.closeSecondary(source2, true);
  }
  // --- RPC ---------------------------------------------------------------------
  async open(source2, req) {
    const session = this.requireSession(source2);
    const left = this.requirePlayerInventory(source2);
    if (req.type === "player" && (req.id === void 0 || Number(req.id) === source2)) {
      this.closeSecondary(source2, false);
      return { left: left.view() };
    }
    const opener = this.openers.get(req.type);
    if (!opener) throw new RpcError("invalid");
    const { inv, check } = await opener(source2, req, session);
    if (!this.sessions.has(source2)) throw new RpcError("not_found");
    const error = check?.();
    if (error) throw new RpcError(error);
    const hook = this.deps.hooks.trigger("openInventory", { source: source2, inventoryId: inv.player ?? inv.id, inventoryType: inv.type });
    if (!hook.allowed) throw new RpcError("hook");
    this.attach(source2, inv, check ?? null, false);
    return { left: left.view(), right: inv.view() };
  }
  /** Abre un secundario por orden del servidor (API / forceOpenInventory): sin comprobaciones. */
  forceOpen(source2, inv) {
    const left = this.manager.get(source2);
    if (!left || !this.sessions.has(source2)) return false;
    this.attach(source2, inv, null, true);
    this.deps.sendOpen(source2, left.view(), inv === left ? void 0 : inv.view());
    return true;
  }
  close(source2) {
    this.closeSecondary(source2, false);
    return true;
  }
  move(source2, req) {
    const session = this.requireSession(source2);
    const left = this.requirePlayerInventory(source2);
    const from = this.sessionInventory(session, left, req.from.inv);
    const to = this.sessionInventory(session, left, req.to.inv);
    if (from.type === "shop" || to.type === "shop") throw new RpcError("invalid");
    if (from !== left || to !== left) this.checkAccess(source2);
    const src = from.get(req.from.slot);
    if (!src || src.name !== req.expect) throw new RpcError("stale");
    const def = this.manager.registry.get(src.name);
    const dst = to.get(req.to.slot);
    const action = !dst ? "move" : dst.name === src.name && def?.stack && sameMetadata(dst.metadata, src.metadata) ? "stack" : "swap";
    const hook = this.deps.hooks.trigger("swapItems", {
      source: source2,
      action,
      fromInventory: hookId(from),
      toInventory: hookId(to),
      fromType: from.type,
      toType: to.type,
      fromSlot: { ...src, slot: req.from.slot },
      toSlot: dst ? { ...dst, slot: req.to.slot } : req.to.slot,
      count: req.count
    });
    if (!hook.allowed) throw new RpcError("hook");
    const result = moveItem(this.manager.registry, from, req.from.slot, to, req.to.slot, req.count);
    if (!result.ok) throw new RpcError(result.error);
    if (from === left) this.releaseWeapon(source2, req.from.slot);
    if (to === left) this.releaseWeapon(source2, req.to.slot);
    this.afterChange([from, to]);
    return { weight: left.weight };
  }
  resync(source2, req) {
    const session = this.requireSession(source2);
    const left = this.requirePlayerInventory(source2);
    return this.sessionInventory(session, left, req.inv).view();
  }
  // --- Después de cambiar ------------------------------------------------------
  /**
   * Manda los parches y programa la copia al framework de los jugadores
   * afectados. La API y las demás operaciones también pasan por aquí.
   */
  afterChange(touched) {
    this.manager.commit();
    if (this.syncing) return;
    for (const inv of touched) {
      if (inv.type === "player" && inv.player !== void 0) this.scheduleFrameworkSync(inv.player);
    }
  }
  scheduleFrameworkSync(source2) {
    if (this.syncTimers.has(source2)) return;
    this.syncTimers.set(
      source2,
      setTimeout(() => {
        this.syncTimers.delete(source2);
        this.syncFramework(source2);
      }, this.deps.config.frameworkSyncDelay)
    );
  }
  syncFramework(source2) {
    const inv = this.manager.get(source2);
    if (!inv || !this.sessions.has(source2)) return;
    const accounts = {};
    for (const item of Object.keys(this.deps.framework.accountItems)) accounts[item] = getItemCount(inv, item);
    const items = inv.toStored().map((stored) => ({ ...stored, label: this.manager.registry.get(stored.name)?.label ?? stored.name }));
    this.syncing = true;
    try {
      this.deps.framework.syncInventory(source2, accounts, items, inv.weight, inv.maxWeight);
    } catch (err) {
      this.deps.log.error(`sincronizar con ${this.deps.framework.name} (${source2}): ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.syncing = false;
    }
  }
  // --- Comprobaciones ----------------------------------------------------------
  requireSession(source2) {
    const session = this.sessions.get(source2);
    if (!session) throw new RpcError("not_found");
    return session;
  }
  requirePlayerInventory(source2) {
    const inv = this.manager.get(source2);
    if (!inv || inv.type !== "player") throw new RpcError("not_found");
    return inv;
  }
  /** Inventario abierto en la sesión (el propio o el secundario). */
  sessionInventory(session, left, id) {
    if (id === left.id) return left;
    if (id === session.right) {
      const inv = this.manager.get(id);
      if (inv) return inv;
    }
    throw new RpcError("no_access");
  }
  /** Si el arma en la mano estaba en esa casilla, deja de estarlo (se movió, se dio, se tiró). */
  releaseWeapon(source2, slot) {
    const session = this.sessions.get(source2);
    if (session?.weapon === slot) delete session.weapon;
  }
  /** El secundario abierto sigue al alcance. Si no, se cierra y la operación falla. */
  checkAccess(source2) {
    const session = this.sessions.get(source2);
    if (!session?.right || session.forced) return;
    const error = session.check?.() ?? null;
    if (error) {
      this.closeSecondary(source2, true);
      throw new RpcError(error);
    }
  }
  /** Grupos y distancia a `inv.coords` (alijos, drops). */
  placeCheck(source2, inv) {
    const session = this.sessions.get(source2);
    if (!session || !hasGroup(session.info.groups, inv.groups)) return "no_access";
    if (!inv.coords) return null;
    return this.near(source2, inv.coords, inv.distance ?? this.deps.config.stashDistance) ? null : "too_far";
  }
  /** ¿Está el jugador a `meters` (más el margen de latencia) de un punto? */
  near(source2, point, meters) {
    const ped = this.deps.world.pedCoords(source2);
    return !!ped && distance(ped, point) <= meters + this.deps.config.distanceTolerance;
  }
  attach(source2, inv, check, forced) {
    const session = this.sessions.get(source2);
    this.closeSecondary(source2, false);
    if (inv.type === "player" && inv.player === source2) return;
    session.right = inv.id;
    session.forced = forced;
    if (check) session.check = check;
    else delete session.check;
    inv.openedBy.add(source2);
  }
  closeSecondary(source2, notify) {
    const session = this.sessions.get(source2);
    if (!session?.right) return;
    const inv = this.manager.get(session.right);
    inv?.openedBy.delete(source2);
    delete session.right;
    delete session.check;
    delete session.forced;
    if (inv) for (const listener of this.closeListeners) listener(source2, inv);
    if (notify) this.deps.sendClose(source2);
  }
};
var hookId = (inv) => inv.player ?? inv.id;

// src/server/features/transfer.ts
var TransferFeature = class {
  deps;
  drops = /* @__PURE__ */ new Map();
  nextDrop = 1;
  constructor(deps) {
    this.deps = deps;
    const { service } = deps;
    service.registerOpener("drop", async (source2, req) => {
      const drop = typeof req.id === "string" ? this.drops.get(req.id) : void 0;
      if (!drop) throw new RpcError("not_found");
      return { inv: drop.inv, check: () => this.dropCheck(source2, drop) };
    });
    service.registerOpener("player", async (source2, req) => {
      const target = Number(req.id);
      if (!Number.isInteger(target) || target === source2) throw new RpcError("invalid");
      const inv = service.manager.get(target);
      if (!inv || inv.type !== "player") throw new RpcError("not_found");
      return { inv, check: () => this.searchCheck(source2, target) };
    });
    service.onClose((_source, inv) => {
      if (inv.type === "drop") this.removeIfEmpty(inv.id);
    });
  }
  /** Drops que debe conocer un jugador al entrar (los de su dimensión). */
  dropsFor(source2) {
    const bucket = this.deps.service.deps.world.bucket(source2);
    return [...this.drops.values()].filter((d) => d.info.bucket === bucket).map((d) => d.info);
  }
  // --- Dar -------------------------------------------------------------------------
  give(source2, req) {
    const { service } = this.deps;
    const { world: world2 } = service.deps;
    if (req.target === source2) throw new RpcError("invalid");
    const from = service.requirePlayerInventory(source2);
    const to = service.manager.get(req.target);
    if (!to || to.type !== "player" || !service.isLoaded(req.target)) throw new RpcError("not_found");
    const a = world2.pedCoords(source2);
    const b = world2.pedCoords(req.target);
    if (!a || !b || distance(a, b) > this.deps.config.giveDistance + service.deps.config.distanceTolerance) throw new RpcError("too_far");
    if (world2.bucket(source2) !== world2.bucket(req.target)) throw new RpcError("too_far");
    if (world2.playerState(req.target, "invBusy")) throw new RpcError("busy");
    const item = from.get(req.slot);
    if (!item) throw new RpcError("not_found");
    if (req.count > item.count) throw new RpcError("not_enough");
    const hook = service.deps.hooks.trigger("swapItems", {
      source: source2,
      action: "give",
      fromInventory: hookId(from),
      toInventory: hookId(to),
      fromType: from.type,
      toType: to.type,
      fromSlot: { ...item, slot: req.slot },
      count: req.count
    });
    if (!hook.allowed) throw new RpcError("hook");
    const registry = service.manager.registry;
    const def = registry.get(item.name);
    if (!def) throw new RpcError("not_found");
    const fits = canCarry(registry, to, item.name, req.count, item.metadata);
    if (!fits.ok) throw new RpcError(fits.error);
    const toSlot = (def.stack ? findSlots(to, item.name, { metadata: item.metadata, strict: true })[0] : void 0) ?? to.firstEmptySlot();
    if (toSlot === void 0) throw new RpcError("no_slot");
    const moved = moveItem(registry, from, req.slot, to, toSlot, req.count);
    if (!moved.ok) throw new RpcError(moved.error);
    service.releaseWeapon(source2, req.slot);
    service.afterChange([from, to]);
    return true;
  }
  // --- Tirar -----------------------------------------------------------------------
  drop(source2, req) {
    const { service } = this.deps;
    const { world: world2 } = service.deps;
    const inv = service.requirePlayerInventory(source2);
    const item = inv.get(req.slot);
    if (!item) throw new RpcError("not_found");
    if (req.count > item.count) throw new RpcError("not_enough");
    const coords = world2.pedCoords(source2);
    if (!coords) throw new RpcError("not_found");
    const bucket = world2.bucket(source2);
    const existing = this.nearbyDrop(coords, bucket);
    const target = existing?.inv ?? this.createDropInventory(coords);
    const hook = service.deps.hooks.trigger("swapItems", {
      source: source2,
      action: "move",
      fromInventory: hookId(inv),
      toInventory: target.id,
      fromType: "player",
      toType: "drop",
      fromSlot: { ...item, slot: req.slot },
      toSlot: 1,
      count: req.count
    });
    if (!hook.allowed) {
      if (!existing) service.manager.remove(target.id);
      throw new RpcError("hook");
    }
    const def = service.manager.registry.get(item.name);
    const toSlot = (def?.stack ? [...target.entries()].find(([, other]) => other.name === item.name && sameMetadata(other.metadata, item.metadata))?.[0] : void 0) ?? target.firstEmptySlot();
    const moved = toSlot === void 0 ? null : moveItem(service.manager.registry, inv, req.slot, target, toSlot, req.count);
    if (!moved?.ok) {
      if (!existing) service.manager.remove(target.id);
      throw new RpcError(moved ? moved.error : "no_slot");
    }
    if (!existing) this.registerDrop(target, coords, bucket);
    service.releaseWeapon(source2, req.slot);
    service.afterChange([inv, target]);
    this.deps.sendDropOpened(source2, target.id);
    return { drop: target.id };
  }
  /** CustomDrop de ox: un drop con objetos, creado por otro recurso. */
  createDrop(prefix, items, coords, bucket = 0, slots, maxWeight, model) {
    const inv = this.createDropInventory(coords, prefix, slots, maxWeight);
    const registry = this.deps.service.manager.registry;
    const ctx = this.deps.service.manager.metaContext();
    for (const entry of items) {
      const result = addItem(registry, inv, entry.name, entry.count, entry.metadata ? { ctx, metadata: entry.metadata, ignoreWeight: true } : { ctx, ignoreWeight: true });
      if (!result.ok) this.deps.service.deps.log.warn(`drop ${inv.id}: no cabe ${entry.count}x ${entry.name} (${result.error})`);
    }
    if (inv.sortedSlots().length === 0) {
      this.deps.service.manager.remove(inv.id);
      return null;
    }
    inv.takeChanges();
    this.registerDrop(inv, coords, bucket, model);
    return inv.id;
  }
  // --- Internos ----------------------------------------------------------------------
  createDropInventory(coords, prefix = "drop", slots, maxWeight) {
    const id = `${prefix.replace(/[^\w-]/g, "").slice(0, 20) || "drop"}-${this.nextDrop++}`;
    return this.deps.service.manager.createTemporary({
      id,
      type: "drop",
      label: t("label_drop", "Ground"),
      slots: slots ?? this.deps.config.dropSlots,
      maxWeight: maxWeight ?? this.deps.config.dropMaxWeight,
      coords,
      distance: 2
    });
  }
  registerDrop(inv, coords, bucket, model) {
    const info = { id: inv.id, coords, bucket, model: model ?? this.deps.config.dropModel };
    this.drops.set(inv.id, { info, inv });
    this.deps.sendDrops(this.playersIn(bucket), [info], void 0);
  }
  removeIfEmpty(id) {
    const drop = this.drops.get(id);
    if (!drop || drop.inv.openedBy.size > 0 || drop.inv.sortedSlots().length > 0) return;
    this.drops.delete(id);
    this.deps.service.manager.remove(id);
    this.deps.sendDrops(this.playersIn(drop.info.bucket), void 0, [id]);
  }
  /** Tras cada cambio: los drops que se han quedado vacíos y sin nadie mirando se quitan. */
  get count() {
    return this.drops.size;
  }
  sweep() {
    for (const id of [...this.drops.keys()]) this.removeIfEmpty(id);
  }
  nearbyDrop(coords, bucket) {
    let best;
    let bestDistance = this.deps.config.dropMergeDistance;
    for (const drop of this.drops.values()) {
      if (drop.info.bucket !== bucket) continue;
      const d = distance(drop.info.coords, coords);
      if (d <= bestDistance) {
        best = drop;
        bestDistance = d;
      }
    }
    return best;
  }
  dropCheck(source2, drop) {
    const { service } = this.deps;
    if (service.deps.world.bucket(source2) !== drop.info.bucket) return "too_far";
    return service.near(source2, drop.info.coords, 2) ? null : "too_far";
  }
  /** Registrar: cerca, misma dimensión y el otro con las manos arriba, esposado o muerto (o eres policía). */
  searchCheck(source2, target) {
    const { service } = this.deps;
    const { world: world2 } = service.deps;
    const a = world2.pedCoords(source2);
    const b = world2.pedCoords(target);
    if (!a || !b || distance(a, b) > this.deps.config.searchDistance + service.deps.config.distanceTolerance) return "too_far";
    if (world2.bucket(source2) !== world2.bucket(target)) return "too_far";
    if (!service.isAuthorized(source2)) return "no_access";
    if (!service.isPolice(source2) && world2.playerState(target, "canSteal") !== true) return "no_access";
    return null;
  }
  playersIn(bucket) {
    const { world: world2 } = this.deps.service.deps;
    return world2.players().filter((player) => world2.bucket(player) === bucket);
  }
};

// src/server/features/use.ts
var USE_TTL_MS = 6e4;
var hasClientUse = (def) => def.useTime !== void 0 || def.anim !== void 0 || def.status !== void 0 || !!def.clientExport || !!def.clientEvent || !!def.serverExport;
var UseFeature = class {
  deps;
  pending = /* @__PURE__ */ new Map();
  nextToken = 1;
  constructor(deps) {
    this.deps = deps;
  }
  forget(source2) {
    this.pending.delete(source2);
  }
  use(source2, req) {
    const { service } = this.deps;
    const session = service.requireSession(source2);
    const inv = service.requirePlayerInventory(source2);
    const item = inv.get(req.slot);
    if (!item) throw new RpcError("not_found");
    const def = service.manager.registry.get(item.name);
    if (!def) throw new RpcError("not_found");
    const previous = this.pending.get(source2);
    if (previous && this.deps.now() - previous.at < USE_TTL_MS) throw new RpcError("busy");
    this.checkDurability(def, item.metadata);
    let mode;
    if (def.weapon) {
      mode = "weapon";
    } else if (def.ammo) {
      const weapon = session.weapon !== void 0 ? inv.get(session.weapon) : void 0;
      const weaponDef = weapon && service.manager.registry.get(weapon.name);
      if (!weaponDef?.weapon || weaponDef.weapon.ammoName !== def.name) throw new RpcError("cannot_use");
      if ((durabilityPercent(weapon.metadata, this.deps.now()) ?? 100) <= 0) throw new RpcError("broken");
      mode = "ammo";
    } else if (def.component) {
      if (session.weapon === void 0 || !inv.get(session.weapon)) throw new RpcError("cannot_use");
      mode = "component";
    } else if (hasClientUse(def)) {
      if (def.consume > 0 && def.consume < 1 && item.count > 1 && inv.firstEmptySlot() === void 0) throw new RpcError("no_slot");
      const hook = service.deps.hooks.trigger("usingItem", { source: source2, inventoryId: source2, item: { ...item, slot: req.slot }, consume: def.consume });
      if (!hook.allowed) throw new RpcError("hook");
      if (def.serverExport && this.deps.callServerExport(def.serverExport, "usingItem", def, source2, req.slot) === false) throw new RpcError("hook");
      mode = "client";
    } else {
      const used = service.deps.framework.useItem(source2, item.name, {
        name: item.name,
        slot: req.slot,
        count: item.count,
        metadata: item.metadata,
        label: typeof item.metadata.label === "string" ? item.metadata.label : def.label
      });
      if (!used) throw new RpcError("cannot_use");
      this.deps.emitUsed(source2, item.name, req.slot, item.metadata);
      return { mode: "done", token: 0, slot: req.slot, name: item.name, count: item.count, metadata: item.metadata };
    }
    const token = this.nextToken++;
    this.pending.set(source2, { token, slot: req.slot, name: item.name, mode, at: this.deps.now() });
    return { mode, token, slot: req.slot, name: item.name, count: item.count, metadata: item.metadata };
  }
  useDone(source2, req) {
    const { service } = this.deps;
    const pending = this.pending.get(source2);
    if (!pending || pending.token !== req.token) throw new RpcError("stale");
    this.pending.delete(source2);
    if (this.deps.now() - pending.at > USE_TTL_MS) throw new RpcError("timeout");
    const session = service.requireSession(source2);
    const inv = service.requirePlayerInventory(source2);
    const item = inv.get(pending.slot);
    if (!item || item.name !== pending.name) throw new RpcError("stale");
    if (!req.success) {
      if (pending.mode === "weapon" && session.weapon === pending.slot) delete session.weapon;
      return true;
    }
    switch (pending.mode) {
      case "weapon":
        session.weapon = pending.slot;
        break;
      case "client": {
        const def = service.manager.registry.get(item.name);
        if (def) this.consume(inv, def, pending.slot);
        if (def?.serverExport) this.deps.callServerExport(def.serverExport, "usedItem", def, source2, pending.slot);
        this.deps.emitUsed(source2, item.name, pending.slot, Object.keys(item.metadata).length ? item.metadata : void 0);
        service.afterChange([inv]);
        break;
      }
      default:
        break;
    }
    return true;
  }
  checkDurability(def, metadata) {
    const durability = durabilityPercent(metadata, this.deps.now());
    if (durability === null || def.weapon) return;
    if (durability <= 0) throw new RpcError("broken");
    if (def.consume > 0 && def.consume < 1 && durability < def.consume * 100) throw new RpcError("broken");
  }
  /**
   * Gasta lo que dice `consume`: unidades enteras, o un porcentaje de la
   * durabilidad. Si es un porcentaje y hay varias unidades, la usada se
   * separa en su propia casilla (como ox).
   */
  consume(inv, def, slot) {
    const item = inv.get(slot);
    if (!item || def.consume <= 0) return;
    if (def.consume >= 1) {
      removeItem(inv, item.name, Math.min(item.count, Math.round(def.consume)), { slot });
      return;
    }
    const now = this.deps.now();
    const current = item.metadata.durability;
    let next;
    if (typeof current === "number" && current > 100) {
      const degrade = (typeof item.metadata.degrade === "number" ? item.metadata.degrade : def.degrade ?? 0) * 60;
      next = current - degrade * def.consume;
      if (next <= now) next = 0;
    } else {
      next = (typeof current === "number" ? current : 100) - def.consume * 100;
    }
    if (item.count > 1) {
      const empty = inv.firstEmptySlot();
      inv.put(slot, { ...item, count: item.count - 1 });
      if (empty !== void 0 && next > 0) inv.put(empty, { name: item.name, count: 1, metadata: { ...cloneJson(item.metadata), durability: next } });
      return;
    }
    if (next <= 0) removeItem(inv, item.name, 1, { slot });
    else setDurability(inv, slot, next);
  }
};

// src/server/features/vehicles.ts
var TRUNK_DISTANCE = 6;
var VehicleFeature = class {
  deps;
  storage = /* @__PURE__ */ new Map();
  models = { trunk: /* @__PURE__ */ new Map(), glovebox: /* @__PURE__ */ new Map() };
  constructor(deps) {
    this.deps = deps;
    for (const [model, flag] of Object.entries(deps.config.storage)) this.storage.set(deps.hash(model), flag);
    for (const kind of ["trunk", "glovebox"]) {
      for (const [model, size] of Object.entries(deps.config[kind].models)) this.models[kind].set(deps.hash(model), size);
    }
    deps.service.registerOpener("trunk", (source2, req, session) => this.open("trunk", source2, req, session));
    deps.service.registerOpener("glovebox", (source2, req, session) => this.open("glovebox", source2, req, session));
  }
  async open(kind, source2, req, session) {
    const { service } = this.deps;
    const { world: world2, framework } = service.deps;
    const netId = Number(req.id);
    const entity = Number.isInteger(netId) && netId > 0 ? world2.entityFromNetId(netId) : 0;
    if (!entity) throw new RpcError("not_found");
    const model = world2.vehicleModel(entity);
    const flag = this.storage.get(model);
    if (flag === 0 || kind === "trunk" && flag === 1 || kind === "glovebox" && flag === 2) throw new RpcError("no_access");
    const vehicleClass = framework.vehicleClass(model) ?? req.vehicleClass ?? null;
    const size = this.models[kind].get(model) ?? (vehicleClass !== null ? this.deps.config[kind].byClass[String(vehicleClass)] : void 0);
    if (!size) throw new RpcError("no_access");
    const check = () => this.check(kind, source2, entity);
    const problem = check();
    if (problem) throw new RpcError(problem);
    const rawPlate = world2.vehiclePlate(entity);
    const plate = this.deps.trimPlate ? rawPlate.trim() : rawPlate;
    if (!plate) throw new RpcError("not_found");
    const id = `${kind === "trunk" ? "trunk" : "glove"}${plate}`.replace(/[^\w:.\-]/g, "");
    const label = `${kind === "trunk" ? t("label_trunk", "Trunk") : t("label_glovebox", "Glovebox")} ${plate}`;
    const loaded = service.manager.get(id);
    if (loaded) return { inv: loaded, check };
    const owned = await framework.ownedVehicleId(entity, plate);
    const again = service.manager.get(id);
    if (again) return { inv: again, check };
    const inv = owned !== null ? await service.manager.loadVehicle(kind, id, owned, label, size.slots, size.maxWeight) : this.temporary(kind, id, label, size, session);
    return { inv, check };
  }
  temporary(kind, id, label, size, session) {
    const { manager } = this.deps.service;
    const inv = manager.createTemporary({ id, type: kind, label, slots: size.slots, maxWeight: size.maxWeight });
    const ctx = manager.metaContext(session.info.name);
    for (const [name2, min, max, chance = 100] of this.deps.loot) {
      if (this.deps.random() * 100 >= chance) continue;
      const count = Math.floor(min + this.deps.random() * (max - min + 1));
      if (count > 0) addItem(manager.registry, inv, name2, count, { ctx });
    }
    inv.takeChanges();
    return inv;
  }
  check(kind, source2, entity) {
    const { world: world2 } = this.deps.service.deps;
    const inside = world2.pedVehicle(source2) === entity;
    if (kind === "glovebox") return inside ? null : "too_far";
    if (inside) return "no_access";
    if (world2.vehicleLockStatus(entity) >= 2) return "no_access";
    const coords = world2.entityCoords(entity);
    return coords && this.deps.service.near(source2, coords, TRUNK_DISTANCE) ? null : "too_far";
  }
};

// src/server/features/weapons.ts
var components = (item) => Array.isArray(item.metadata.components) ? item.metadata.components.filter((c) => typeof c === "string") : [];
var WeaponFeature = class {
  service;
  constructor(service) {
    this.service = service;
  }
  /** Arma en la mano: casilla, objeto y definición. Si ya no está, se suelta. */
  equipped(source2) {
    const session = this.service.requireSession(source2);
    const inv = this.service.requirePlayerInventory(source2);
    const slot = session.weapon;
    const item = slot !== void 0 ? inv.get(slot) : void 0;
    if (slot === void 0 || !item || !this.service.manager.registry.get(item.name)?.weapon) {
      delete session.weapon;
      throw new RpcError("cannot_use");
    }
    return { session, inv, slot, item };
  }
  put(inv, slot, item, metadata) {
    inv.put(slot, { ...item, metadata: { ...item.metadata, ...metadata } });
  }
  disarm(source2) {
    const session = this.service.session(source2);
    if (session) delete session.weapon;
    return true;
  }
  /** Disparos (munición que baja) o golpes cuerpo a cuerpo (`shots`). */
  update(source2, req) {
    const { inv, slot, item } = this.equipped(source2);
    if (req.slot !== slot) throw new RpcError("stale");
    const def = this.service.manager.registry.get(item.name);
    const loss = def.weapon.durability;
    const durability = typeof item.metadata.durability === "number" ? item.metadata.durability : 100;
    const ammo = typeof item.metadata.ammo === "number" ? item.metadata.ammo : void 0;
    if (FUEL_LIKE_WEAPONS.includes(def.name)) {
      const value = Math.max(0, Math.min(durability, req.ammo));
      this.put(inv, slot, item, { durability: value, ammo: value });
    } else if (ammo !== void 0 && req.ammo < ammo) {
      this.put(inv, slot, item, { ammo: req.ammo, durability: Math.max(0, durability - loss * (ammo - req.ammo)) });
    } else if (ammo === void 0 && req.shots > 0) {
      this.put(inv, slot, item, { durability: Math.max(0, durability - loss * req.shots) });
    } else {
      return true;
    }
    this.service.afterChange([inv]);
    return true;
  }
  /** Recarga: el cliente dice cuánta munición queda en el arma; se quita la diferencia del inventario. */
  reload(source2, req) {
    const { inv, slot, item } = this.equipped(source2);
    const def = this.service.manager.registry.get(item.name);
    const ammoName = def.weapon.ammoName;
    if (!ammoName) throw new RpcError("cannot_use");
    const current = typeof item.metadata.ammo === "number" ? item.metadata.ammo : 0;
    if (req.ammo <= current) return { ammo: current };
    if (typeof item.metadata.durability === "number" && item.metadata.durability <= 0) throw new RpcError("broken");
    const special = typeof item.metadata.specialAmmo === "string" ? { type: item.metadata.specialAmmo } : void 0;
    const available = getItemCount(inv, ammoName, special ? { metadata: special } : {});
    const add = Math.min(req.ammo - current, available);
    if (add <= 0) throw new RpcError("not_enough");
    const removed = removeItem(inv, ammoName, add, special ? { metadata: special } : {});
    if (!removed.ok) throw new RpcError(removed.error);
    this.put(inv, slot, inv.get(slot), { ammo: current + add });
    this.service.afterChange([inv]);
    return { ammo: current + add };
  }
  /** Arrojadizo lanzado: se gasta una unidad. */
  throw(source2) {
    const { session, inv, slot, item } = this.equipped(source2);
    if (!this.service.manager.registry.get(item.name)?.weapon?.throwable) throw new RpcError("cannot_use");
    removeItem(inv, item.name, 1, { slot });
    if (!inv.get(slot)) delete session.weapon;
    this.service.afterChange([inv]);
    return true;
  }
  /** Pone en el arma de la mano el accesorio de una casilla. */
  addComponent(source2, req) {
    const { inv, slot, item } = this.equipped(source2);
    const component = inv.get(req.slot);
    const registry = this.service.manager.registry;
    const def = component && registry.get(component.name);
    if (!component || !def?.component) throw new RpcError("not_found");
    const current = components(item);
    if (current.some((name2) => registry.get(name2)?.component?.type === def.component.type)) throw new RpcError("cannot_use");
    const removed = removeItem(inv, component.name, 1, { slot: req.slot });
    if (!removed.ok) throw new RpcError(removed.error);
    this.put(inv, slot, inv.get(slot), { components: [...current, component.name] });
    this.service.afterChange([inv]);
    return true;
  }
  /** Quita un accesorio de un arma (no hace falta tenerla en la mano) y lo devuelve al inventario. */
  removeComponent(source2, req) {
    const inv = this.service.requirePlayerInventory(source2);
    const item = inv.get(req.slot);
    if (!item) throw new RpcError("not_found");
    const current = components(item);
    const index = current.indexOf(req.component);
    if (index === -1) throw new RpcError("not_found");
    const added = addItem(this.service.manager.registry, inv, req.component, 1, { ctx: this.service.manager.metaContext() });
    if (!added.ok) throw new RpcError(added.error);
    current.splice(index, 1);
    this.put(inv, req.slot, inv.get(req.slot), { components: current });
    this.service.afterChange([inv]);
    return true;
  }
  /** Saca la munición de un arma al inventario. */
  removeAmmo(source2, req) {
    const session = this.service.requireSession(source2);
    if (session.weapon === req.slot) throw new RpcError("busy");
    const inv = this.service.requirePlayerInventory(source2);
    const item = inv.get(req.slot);
    const def = item && this.service.manager.registry.get(item.name);
    const ammo = typeof item?.metadata.ammo === "number" ? item.metadata.ammo : 0;
    if (!item || !def?.weapon?.ammoName || ammo < 1) throw new RpcError("not_found");
    const special = typeof item.metadata.specialAmmo === "string" ? { type: item.metadata.specialAmmo } : void 0;
    const added = addItem(this.service.manager.registry, inv, def.weapon.ammoName, ammo, {
      ctx: this.service.manager.metaContext(),
      ...special ? { metadata: special } : {}
    });
    if (!added.ok) throw new RpcError(added.error);
    this.put(inv, req.slot, inv.get(req.slot), { ammo: 0 });
    this.service.afterChange([inv]);
    return true;
  }
};

// src/server/frameworks/detect.ts
var RESOURCES = [
  ["qbx", "qbx_core"],
  ["esx", "es_extended"],
  ["qb", "qb-core"]
];
function detectFramework(warn) {
  const forced = GetConvar("nx_inventory:framework", "").trim().toLowerCase();
  if (forced === "qbx" || forced === "qb" || forced === "esx") return forced;
  if (forced) warn(`nx_inventory:framework = '${forced}' no es v\xE1lido (qbx, qb o esx); se detecta solo`);
  for (const [kind, resource] of RESOURCES) {
    if (GetResourceState(resource) !== "missing") return kind;
  }
  warn("no se encuentra qbx_core, es_extended ni qb-core; se usa qbx");
  return "qbx";
}

// src/server/frameworks/esx.ts
var ACCOUNT_ITEMS = { money: "money", black_money: "black_money" };
var EsxFramework = class {
  name = "esx";
  accountItems = ACCOUNT_ITEMS;
  log;
  db;
  cached;
  /** xPlayer de cada jugador cargado: pedirlo en cada sincronización crearía referencias nuevas */
  players = /* @__PURE__ */ new Map();
  licenses = /* @__PURE__ */ new Map();
  constructor(log, db) {
    this.log = log;
    this.db = db;
  }
  get esx() {
    this.cached ??= exports.es_extended.getSharedObject();
    return this.cached;
  }
  start(events) {
    const load = (xPlayer) => {
      if (!xPlayer || typeof xPlayer.identifier !== "string") return;
      const source2 = Number(xPlayer.source);
      const known = this.players.get(source2);
      if (known && known.identifier === xPlayer.identifier) return;
      this.players.set(source2, xPlayer);
      void this.loadLicenses(source2, xPlayer.identifier).finally(() => {
        if (this.players.get(source2) === xPlayer) events.loaded(this.toInfo(xPlayer));
      });
    };
    on("__cfx_export_ox_inventory_setPlayerInventory", (setCB) => setCB((xPlayer) => load(xPlayer)));
    on("ox_inventory:setPlayerInventory", (xPlayer) => load(xPlayer));
    on("esx:playerLoaded", (_source, xPlayer) => load(xPlayer));
    const logout = (source2) => {
      const src = Number(source2);
      if (!this.players.delete(src)) return;
      this.licenses.delete(src);
      events.logout(src);
    };
    on("esx:playerDropped", logout);
    on("esx:playerLogout", logout);
    on("esx:setJob", (source2, job, lastJob) => {
      const src = Number(source2);
      const xPlayer = this.players.get(src);
      if (xPlayer) xPlayer.job = job;
      if (lastJob?.name && lastJob.name !== job?.name) events.groupChanged(src, lastJob.name, void 0);
      if (job?.name) events.groupChanged(src, job.name, Number(job.grade) || 0);
    });
    const refreshLicenses = (target) => {
      const xPlayer = this.players.get(Number(target));
      if (xPlayer) setTimeout(() => void this.loadLicenses(Number(target), xPlayer.identifier), 500);
    };
    on("esx_license:addLicense", refreshLicenses);
    on("esx_license:removeLicense", refreshLicenses);
    setTimeout(() => {
      for (const xPlayer of this.esx.GetExtendedPlayers() ?? []) load(xPlayer);
    }, 500);
  }
  async loadLicenses(source2, identifier) {
    try {
      const rows = await this.db.select("SELECT type FROM user_licenses WHERE owner = ?", [identifier]);
      this.licenses.set(source2, new Set(rows.map((r) => r.type)));
    } catch (err) {
      this.licenses.set(source2, /* @__PURE__ */ new Set());
      this.log.warn(`licencias de ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  isGang() {
    return false;
  }
  getPlayer(source2) {
    const xPlayer = this.players.get(source2) ?? this.esx.GetPlayerFromId(source2);
    return xPlayer ? this.toInfo(xPlayer) : null;
  }
  syncInventory(source2, accounts, items, weight = 0, maxWeight = 0) {
    const xPlayer = this.players.get(source2);
    if (!xPlayer) return;
    const bySlot = [];
    for (const item of items) bySlot[item.slot - 1] = item;
    for (let i = 0; i < bySlot.length; i++) if (bySlot[i] === void 0) bySlot[i] = null;
    const money = {};
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS)) money[account] = accounts[item] ?? 0;
    xPlayer.syncInventory(weight, maxWeight, bySlot, money);
  }
  hasLicense(source2, license) {
    return this.licenses.get(source2)?.has(license) === true;
  }
  isBoss(source2, group) {
    const job = this.players.get(source2)?.job;
    return job?.name === group && job.grade_name === "boss";
  }
  useItem(source2, name2, slot) {
    const usable = this.esx.GetUsableItems?.();
    if (usable && !usable[name2]) return false;
    this.esx.UseItem(source2, name2, slot);
    return true;
  }
  vehicleClass() {
    return null;
  }
  /** owned_vehicles se identifica por matrícula. Si la base de datos falla, no se abre. */
  ownedVehicleId(_entity, plate) {
    return this.db.vehicleKeyByPlate(plate);
  }
  toInfo(xPlayer) {
    const accounts = {};
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS)) {
      const amount = xPlayer.accounts?.find((a) => a.name === account)?.money;
      if (typeof amount === "number") accounts[item] = Math.max(0, Math.floor(amount));
    }
    const groups = {};
    if (xPlayer.job?.name) groups[xPlayer.job.name] = Number(xPlayer.job.grade) || 0;
    return {
      source: Number(xPlayer.source),
      owner: xPlayer.identifier,
      name: xPlayer.name || xPlayer.identifier,
      groups,
      accounts
    };
  }
};

// src/server/frameworks/qb.ts
var ACCOUNT_ITEMS2 = { money: "cash" };
var QbFramework = class {
  name = "qb";
  accountItems = ACCOUNT_ITEMS2;
  log;
  vehicleByPlate;
  cached;
  /** Player de cada jugador cargado: pedirlo en cada sincronización crearía referencias nuevas */
  players = /* @__PURE__ */ new Map();
  /** último trabajo y banda de cada jugador: los eventos de QBCore no dicen cuál tenía antes */
  lastGroups = /* @__PURE__ */ new Map();
  constructor(log, vehicleByPlate) {
    this.log = log;
    this.vehicleByPlate = vehicleByPlate;
  }
  get core() {
    this.cached ??= exports["qb-core"].GetCoreObject();
    return this.cached;
  }
  start(events) {
    events.importItems(this.sharedItems());
    const load = (player) => {
      const info = player?.PlayerData ? this.toInfo(player.PlayerData) : null;
      if (!info) return false;
      this.players.set(info.source, player);
      events.loaded(info);
      return true;
    };
    on("QBCore:Server:PlayerLoaded", (player) => {
      if (!load(player)) this.log.warn("QBCore:Server:PlayerLoaded sin PlayerData");
    });
    on("QBCore:Server:OnPlayerUnload", (source2) => {
      this.lastGroups.delete(Number(source2));
      this.players.delete(Number(source2));
      events.logout(Number(source2));
    });
    const groupUpdate = (kind) => (source2, group) => {
      const src = Number(source2);
      const last = this.lastGroups.get(src) ?? {};
      if (last[kind] && last[kind] !== group?.name) events.groupChanged(src, last[kind], void 0);
      if (group?.name && !(kind === "gang" && group.name === "none")) events.groupChanged(src, group.name, group.grade?.level ?? 0);
      last[kind] = group?.name;
      this.lastGroups.set(src, last);
    };
    on("QBCore:Server:OnJobUpdate", groupUpdate("job"));
    on("QBCore:Server:OnGangUpdate", groupUpdate("gang"));
    on("QBCore:Server:OnMoneyChange", (source2, account) => {
      for (const [item, name2] of Object.entries(ACCOUNT_ITEMS2)) {
        if (account !== name2) continue;
        const amount = this.players.get(Number(source2))?.Functions.GetMoney(name2);
        if (typeof amount === "number") events.accountChanged(Number(source2), item, Math.max(0, Math.floor(amount)));
      }
    });
    setTimeout(() => {
      for (const player of Object.values(this.core.Functions.GetQBPlayers() ?? {})) load(player);
    }, 500);
  }
  /** QBCore.Shared.Items en el formato de config/items.jsonc (sin armas: van en weapons.jsonc). */
  sharedItems() {
    const out = {};
    let weapons = 0;
    for (const [key, item] of Object.entries(this.core.Shared.Items ?? {})) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "weapon") {
        weapons++;
        continue;
      }
      const config = {
        label: typeof item.label === "string" ? item.label : key,
        weight: typeof item.weight === "number" ? item.weight : 0,
        stack: item.unique !== true,
        close: item.shouldClose !== false
      };
      if (typeof item.description === "string" && item.description) config.description = item.description;
      if (typeof item.image === "string" && item.image) config.image = item.image.replace(/\.(png|webp|jpg)$/i, "");
      out[item.name ?? key] = config;
    }
    if (weapons > 0) this.log.info(`QBCore.Shared.Items: ${weapons} armas ignoradas (las armas salen de config/weapons.jsonc)`);
    return out;
  }
  isGang(group) {
    return group !== "none" && this.core.Shared.Gangs?.[group] !== void 0;
  }
  getPlayer(source2) {
    const player = this.core.Functions.GetPlayer(source2);
    return player ? this.toInfo(player.PlayerData) : null;
  }
  syncInventory(source2, accounts, items) {
    const player = this.players.get(source2);
    if (!player) return;
    const bySlot = [];
    for (const raw of items) {
      const shared = this.core.Shared.Items?.[raw.name];
      bySlot[raw.slot - 1] = { ...raw, amount: raw.count, info: raw.metadata ?? {}, type: shared?.type ?? "item", image: shared?.image };
    }
    for (let i = 0; i < bySlot.length; i++) if (bySlot[i] === void 0) bySlot[i] = null;
    player.Functions.SetPlayerData("items", bySlot);
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS2)) {
      const amount = accounts[item] ?? 0;
      if (player.Functions.GetMoney(account) !== amount) player.Functions.SetMoney(account, amount, `Sincronizar ${account} con el inventario`);
    }
  }
  hasLicense(source2, license) {
    return this.core.Functions.GetPlayer(source2)?.PlayerData.metadata?.licences?.[license] === true;
  }
  isBoss(_source, group, grade) {
    const shared = this.core.Shared.Jobs?.[group] ?? this.core.Shared.Gangs?.[group];
    return shared?.grades?.[String(grade)]?.isboss === true;
  }
  useItem(source2, name2, slot) {
    const usable = this.core.Functions.CanUseItem(name2);
    const fn = typeof usable === "function" ? usable : usable?.func;
    if (typeof fn !== "function") return false;
    fn(source2, { ...slot, amount: slot.count, info: slot.metadata });
    return true;
  }
  vehicleClass() {
    return null;
  }
  /**
   * player_vehicles.id por matrícula (QBCore no pone el id en la entidad). Si la base de datos
   * falla, no se abre: tratarlo como sin dueño daría un maletero temporal que no se guarda.
   */
  ownedVehicleId(_entity, plate) {
    return this.vehicleByPlate(plate);
  }
  toInfo(data) {
    if (!data || typeof data.citizenid !== "string") return null;
    const source2 = Number(data.source);
    const first = data.charinfo?.firstname ?? "";
    const last = data.charinfo?.lastname ?? "";
    const accounts = {};
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS2)) {
      const amount = data.money?.[account];
      if (typeof amount === "number") accounts[item] = Math.max(0, Math.floor(amount));
    }
    const groups = {};
    if (data.job?.name) groups[data.job.name] = data.job.grade?.level ?? 0;
    if (data.gang?.name && data.gang.name !== "none") groups[data.gang.name] = data.gang.grade?.level ?? 0;
    this.lastGroups.set(source2, { job: data.job?.name, gang: data.gang?.name });
    return {
      source: source2,
      owner: data.citizenid,
      name: `${first} ${last}`.trim() || data.citizenid,
      groups,
      accounts
    };
  }
};

// src/server/frameworks/qbx.ts
var ACCOUNT_ITEMS3 = { money: "cash" };
var QbxFramework = class {
  name = "qbx";
  accountItems = ACCOUNT_ITEMS3;
  log;
  constructor(log) {
    this.log = log;
  }
  get core() {
    return exports.qbx_core;
  }
  start(events) {
    AddStateBagChangeHandler("loadInventory", null, (bagName, _key, value) => {
      if (!value) return;
      const source2 = GetPlayerFromStateBagName(bagName);
      if (!source2) return;
      const info = this.getPlayer(source2);
      if (info) events.loaded(info);
      else this.log.warn(`loadInventory de ${source2} sin jugador en qbx_core`);
    });
    on("qbx_core:server:playerLoggedOut", (source2) => events.logout(Number(source2)));
    on("qbx_core:server:onGroupUpdate", (source2, group, grade) => {
      events.groupChanged(Number(source2), group, typeof grade === "number" ? grade : void 0);
    });
    setTimeout(() => {
      for (const data of this.core.GetPlayersData() ?? []) {
        const info = this.toInfo(data);
        if (info) events.loaded(info);
      }
    }, 500);
  }
  isGang(group) {
    if (group === "none") return false;
    try {
      return this.core.GetGangs()?.[group] !== void 0;
    } catch {
      return false;
    }
  }
  getPlayer(source2) {
    const player = this.core.GetPlayer(source2);
    return player ? this.toInfo(player.PlayerData) : null;
  }
  syncInventory(source2, accounts, items) {
    const core = this.core;
    core.SetPlayerData(source2, "items", items);
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS3)) {
      const amount = accounts[item] ?? 0;
      if (core.GetMoney(source2, account) !== amount) core.SetMoney(source2, account, amount, `Sincronizar ${account} con el inventario`);
    }
  }
  hasLicense(source2, license) {
    const licences = this.core.GetPlayer(source2)?.PlayerData.metadata?.licences;
    return licences?.[license] === true;
  }
  isBoss(_source, group, grade) {
    return this.core.IsGradeBoss(group, grade) === true;
  }
  useItem(source2, name2, slot) {
    const cb = this.core.CanUseItem(name2);
    if (typeof cb !== "function") return false;
    cb(source2, slot);
    return true;
  }
  vehicleClass(model) {
    try {
      const value = this.core.GetVehicleClass(model);
      return typeof value === "number" ? value : null;
    } catch {
      return null;
    }
  }
  ownedVehicleId(entity, plate) {
    const fromState = Entity(entity).state.vehicleid;
    if (typeof fromState === "number" || typeof fromState === "string") return fromState;
    if (GetResourceState("qbx_vehicles") !== "started") return null;
    try {
      const id = exports.qbx_vehicles.GetVehicleIdByPlate(plate);
      return typeof id === "number" ? id : null;
    } catch {
      return null;
    }
  }
  toInfo(data) {
    if (!data || typeof data.citizenid !== "string") return null;
    const source2 = Number(data.source);
    const first = data.charinfo?.firstname ?? "";
    const last = data.charinfo?.lastname ?? "";
    const accounts = {};
    for (const [item, account] of Object.entries(ACCOUNT_ITEMS3)) {
      const amount = data.money?.[account];
      if (typeof amount === "number") accounts[item] = Math.max(0, Math.floor(amount));
    }
    return {
      source: source2,
      owner: data.citizenid,
      name: `${first} ${last}`.trim() || data.citizenid,
      groups: this.core.GetGroups(source2) ?? {},
      accounts
    };
  }
};
var QBX_BRIDGE_FILES = ["bridge/qb/server/main.lua", "bridge/qb/shared/main.lua"];
function checkQbxBridge(warn) {
  if (GetConvar("qbx:enablebridge", "true") === "false") return;
  if (LoadResourceFile("ox_inventory", "fxmanifest.lua")) return;
  const pending = QBX_BRIDGE_FILES.filter((path) => {
    const content = LoadResourceFile("qbx_core", path);
    return typeof content === "string" && content.includes("@ox_inventory.data.") && !content.includes("@nx_inventory.data.");
  });
  if (pending.length === 0) return;
  warn(
    `qbx_core pide '@ox_inventory.data.items/weapons' en ${pending.join(" y ")} y fallar\xE1 sin ox_inventory. Cambia '@ox_inventory.data.' por '@nx_inventory.data.' en esos archivos (o pon setr qbx:enablebridge false si no usas recursos de QBCore).`
  );
}

// src/server/compat/qb.ts
var then2 = (value, fn) => typeof value?.then === "function" ? value.then(fn) : fn(value);
var all = (values) => values.some((v) => typeof v?.then === "function") ? Promise.all(values) : values;
function registerQbCompat(deps) {
  const { api, service, shops } = deps;
  const registry = service.manager.registry;
  const qbSlot = (view) => {
    if (!view?.name) return null;
    const def = registry.get(view.name);
    return {
      name: view.name,
      label: def?.label ?? view.name,
      weight: def?.weight ?? 0,
      type: def?.weapon ? "weapon" : "item",
      amount: view.count,
      count: view.count,
      info: view.metadata ?? {},
      metadata: view.metadata ?? {},
      slot: view.slot,
      image: `${def?.image ?? view.name}.png`,
      unique: def ? !def.stack : false,
      useable: true,
      shouldClose: def?.close ?? true,
      description: def?.description ?? ""
    };
  };
  const slots = (source2, name2) => then2(api.search(Number(source2), "slots", name2), (r) => Array.isArray(r) ? r : []);
  const hasItem = (source2, items, amount) => {
    const wanted = typeof items === "string" ? [[items, Number(amount) || 1]] : Array.isArray(items) ? items.filter((n) => typeof n === "string").map((n) => [n, Number(amount) || 1]) : typeof items === "object" && items !== null ? Object.entries(items).map(([n, c]) => [n, Number(c) || Number(amount) || 1]) : [];
    if (wanted.length === 0) return false;
    const counts = wanted.map(([name2]) => api.getItemCount(Number(source2), name2));
    return then2(all(counts), (list) => list.every((count, i) => count >= wanted[i][1]));
  };
  const open = (source2, ref) => then2(api.resolve(ref), (inv) => inv ? service.forceOpen(Number(source2), inv) : false);
  const exportsQb = {
    LoadInventory: () => [],
    SaveInventory: () => void 0,
    AddItem: (source2, item, amount, slot, info) => then2(api.addItem(Number(source2), item, Math.floor(Number(amount) || 1), info ?? void 0, typeof slot === "number" ? slot : void 0), (r) => r.ok),
    RemoveItem: (source2, item, amount, slot) => then2(api.removeItem(Number(source2), item, Math.floor(Number(amount) || 1), void 0, typeof slot === "number" ? slot : void 0), (r) => r.ok),
    HasItem: (source2, items, amount) => hasItem(source2, items, amount),
    GetItemCount: (source2, items) => {
      const names = typeof items === "string" ? [items] : Array.isArray(items) ? items : [];
      return then2(all(names.map((n) => api.getItemCount(Number(source2), n))), (list) => list.reduce((a, b) => a + b, 0));
    },
    GetItemByName: (source2, item) => then2(slots(source2, item), (list) => qbSlot(list[0])),
    GetItemsByName: (source2, item) => then2(slots(source2, item), (list) => list.map(qbSlot)),
    GetItemBySlot: (source2, slot) => then2(api.getSlot(Number(source2), Number(slot)), qbSlot),
    GetSlotsByItem: (items, name2) => Object.values(items ?? {}).filter((i) => i?.name === name2).map((i) => i.slot),
    GetFirstSlotByItem: (items, name2) => Object.values(items ?? {}).find((i) => i?.name === name2)?.slot ?? null,
    CanAddItem: (source2, item, amount) => api.canCarry(Number(source2), item, Math.floor(Number(amount) || 1)),
    GetFreeWeight: (source2) => then2(api.resolve(Number(source2)), (inv) => inv?.freeWeight() ?? 0),
    GetTotalWeight: (items) => Object.values(items ?? {}).reduce((sum, i) => sum + (i ? (i.weight ?? 0) * (i.amount ?? 1) : 0), 0),
    ClearInventory: (source2, keep) => api.clearInventory(Number(source2), keep),
    SetItemData: (source2, item, key, value) => then2(slots(source2, item), (list) => {
      const first = list[0];
      if (!first || typeof key !== "string") return false;
      return then2(api.setMetadata(Number(source2), first.slot, { ...first.metadata ?? {}, [key]: value }), (r) => r.ok);
    }),
    /** OpenInventory(source, 'stash_x', { label, maxweight, slots }) o el server id de otro jugador. */
    OpenInventory: (source2, identifier, data) => {
      if (identifier === void 0 || identifier === null) return false;
      if (typeof identifier === "number" || /^\d+$/.test(String(identifier))) return open(source2, Number(identifier));
      const name2 = String(identifier);
      if (!service.manager.getStashDef(name2)) {
        api.registerStash({
          name: name2,
          label: typeof data?.label === "string" ? data.label : name2,
          slots: typeof data?.slots === "number" ? data.slots : 50,
          maxWeight: typeof data?.maxweight === "number" ? data.maxweight : 1e5
        });
      }
      return open(source2, name2);
    },
    OpenInventoryById: (source2, target) => open(source2, Number(target)),
    /** CreateShop({ name, label, coords, items = {{ name, price, amount }} }) */
    CreateShop: (data) => {
      const d = data ?? {};
      if (typeof d.name !== "string" || !Array.isArray(d.items)) return false;
      const items = d.items.filter((i) => typeof i?.name === "string").map((i) => ({ name: i.name, price: typeof i.price === "number" ? i.price : 0 }));
      const point = toVec3(d.coords);
      shops.register(d.name, { label: typeof d.label === "string" ? d.label : d.name, items, ...point ? { locations: [point] } : {} });
      return true;
    },
    OpenShop: (source2, name2) => {
      if (typeof name2 !== "string" || !shops.get(name2)) return false;
      emitNet("ox_inventory:openInventory", Number(source2), "shop", name2);
      return true;
    }
  };
  for (const [name2, fn] of Object.entries(exportsQb)) {
    deps.on(`__cfx_export_qb-inventory_${name2}`, ((setCB) => setCB(fn)));
  }
}

// src/server/persistence/store.ts
var emptyBatch = () => ({ players: [], stashes: [], vehicles: [] });
var batchSize = (batch) => batch.players.length + batch.stashes.length + batch.vehicles.length;
function parseStoredItems(registry, raw, slots, now) {
  const result = { items: [], orphans: [], problems: [] };
  if (raw === null || raw === "" || raw === "null") return result;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    result.problems.push("JSON no v\xE1lido; el inventario se carga vac\xEDo");
    return result;
  }
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const values = Object.values(parsed);
    if (values.length > 0 && values.every((v) => typeof v === "number")) {
      parsed = Object.entries(parsed).filter(([, count]) => count > 0).map(([name2, count], index) => ({ slot: index + 1, name: name2, count }));
    }
  }
  const entries = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null ? Object.values(parsed) : null;
  if (!entries) {
    result.problems.push("formato desconocido; el inventario se carga vac\xEDo");
    return result;
  }
  const used = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw2 = entry;
    const { slot, name: name2 } = raw2;
    const count = raw2.count ?? raw2.amount;
    const metadata = raw2.metadata ?? raw2.info;
    if (typeof name2 !== "string" || typeof slot !== "number" || !Number.isInteger(slot) || slot < 1 || slot > LIMITS.slot) {
      result.problems.push(`entrada descartada: ${JSON.stringify(entry).slice(0, 120)}`);
      continue;
    }
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > LIMITS.count) {
      result.problems.push(`casilla ${slot} (${name2}): cantidad no v\xE1lida ${String(count)}, descartada`);
      continue;
    }
    const clean = sanitizeMetadata(metadata);
    const stored = { slot, name: name2, count };
    if (clean && Object.keys(clean).length > 0) stored.metadata = clean;
    const def = registry.get(name2);
    if (!def || slot > slots || used.has(slot)) {
      result.orphans.push(stored);
      result.problems.push(
        `casilla ${slot} (${name2}) apartada: ${!def ? "el objeto no existe" : slot > slots ? "fuera de rango" : "casilla repetida"}`
      );
      continue;
    }
    if (clean === null) result.problems.push(`casilla ${slot} (${name2}): metadatos no v\xE1lidos, se cargan vac\xEDos`);
    used.add(slot);
    result.items.push([slot, { name: normalizeItemName(def.name), count: def.stack ? count : 1, metadata: checkMetadata(registry, def, clean ?? {}, { now }) }]);
    if (!def.stack && count > 1) {
      result.orphans.push({ ...stored, count: count - 1 });
      result.problems.push(`casilla ${slot} (${name2}): no apilable con cantidad ${count}, ${count - 1} apartadas`);
    }
  }
  return result;
}
function serializeItems(items) {
  return items.length > 0 ? JSON.stringify(items) : null;
}

// src/server/inventory/inventory.ts
var Inventory = class {
  id;
  type;
  label;
  slots;
  maxWeight;
  owner;
  dbId;
  persistent;
  groups;
  coords;
  distance;
  /** server id del jugador si es un inventario de jugador */
  player;
  /** jugadores que lo tienen abierto como secundario */
  openedBy = /* @__PURE__ */ new Set();
  /** precio y moneda por casilla (solo tiendas) */
  shopSlots;
  /**
   * Casillas guardadas que no se pueden cargar (objeto que ya no existe,
   * casilla fuera de rango). No se ven ni se tocan, pero se vuelven a guardar
   * tal cual: quitar un objeto de la configuración no borra datos de nadie.
   */
  orphans = [];
  rev = 0;
  dirty = false;
  weight = 0;
  items = /* @__PURE__ */ new Map();
  /** peso de cada casilla en el momento de ponerla: restar lo que se sumó, aunque alguien haya mutado el objeto */
  weights = /* @__PURE__ */ new Map();
  changed = /* @__PURE__ */ new Set();
  sizeChanged = false;
  registry;
  constructor(init, registry) {
    this.registry = registry;
    this.id = init.id;
    this.type = init.type;
    this.label = init.label;
    this.slots = init.slots;
    this.maxWeight = init.maxWeight;
    this.owner = init.owner;
    this.dbId = init.dbId;
    this.persistent = init.persistent;
    this.groups = init.groups;
    this.coords = init.coords;
    this.distance = init.distance;
  }
  get(slot) {
    return this.items.get(slot);
  }
  entries() {
    return this.items.entries();
  }
  /** Casillas ocupadas, en orden. */
  sortedSlots() {
    return [...this.items.keys()].sort((a, b) => a - b);
  }
  firstEmptySlot(from = 1) {
    for (let slot = from; slot <= this.slots; slot++) if (!this.items.has(slot)) return slot;
    return void 0;
  }
  freeWeight() {
    return this.maxWeight - this.weight;
  }
  weightOf(item) {
    const def = this.registry.get(item.name);
    return def ? slotWeight(this.registry, def, item) : 0;
  }
  /** Único sitio donde cambia el contenido. `null` vacía la casilla. */
  put(slot, item) {
    this.weight -= this.weights.get(slot) ?? 0;
    if (item && item.count > 0) {
      const weight = this.weightOf(item);
      this.items.set(slot, item);
      this.weights.set(slot, weight);
      this.weight += weight;
    } else {
      this.items.delete(slot);
      this.weights.delete(slot);
    }
    this.weight = Math.round(this.weight * 1e3) / 1e3;
    this.changed.add(slot);
    if (this.persistent) this.dirty = true;
  }
  /** Carga inicial: no cuenta como cambio ni marca para guardar. */
  load(items, orphans = []) {
    this.items.clear();
    this.weights.clear();
    for (const [slot, item] of items) this.items.set(slot, item);
    this.orphans = orphans;
    this.recalculateWeight();
  }
  /** Cambia el tamaño (SetSlotCount / SetMaxWeight). */
  resize(slots, maxWeight) {
    if (slots !== void 0) this.slots = slots;
    if (maxWeight !== void 0) this.maxWeight = maxWeight;
    this.sizeChanged = true;
    if (this.persistent) this.dirty = true;
  }
  /** Recalcula el peso entero (tras cargar, o si cambian definiciones). */
  recalculateWeight() {
    let weight = 0;
    for (const [slot, item] of this.items) {
      const w = this.weightOf(item);
      this.weights.set(slot, w);
      weight += w;
    }
    this.weight = Math.round(weight * 1e3) / 1e3;
  }
  hasChanges() {
    return this.changed.size > 0 || this.sizeChanged;
  }
  /** Recoge los cambios pendientes y sube la versión. */
  takeChanges() {
    if (!this.hasChanges()) return null;
    const slots = [...this.changed].sort((a, b) => a - b);
    const resized = this.sizeChanged;
    this.changed.clear();
    this.sizeChanged = false;
    this.rev++;
    return { slots, resized };
  }
  slotView(slot) {
    const item = this.items.get(slot);
    if (!item) return { slot, name: "" };
    const view = { slot, name: item.name, count: item.count, weight: this.weightOf(item) };
    if (Object.keys(item.metadata).length > 0) view.metadata = item.metadata;
    const shop = this.shopSlots?.get(slot);
    return shop ? { ...view, ...shop } : view;
  }
  view(readOnly = false) {
    const items = [];
    for (const slot of this.sortedSlots()) items.push(this.slotView(slot));
    const view = {
      id: this.id,
      type: this.type,
      label: this.label,
      slots: this.slots,
      maxWeight: this.maxWeight,
      weight: this.weight,
      rev: this.rev,
      items
    };
    if (readOnly) view.readOnly = true;
    return view;
  }
  /** Formato de guardado (el de ox). */
  toStored() {
    const out = [];
    for (const slot of this.sortedSlots()) {
      const item = this.items.get(slot);
      const stored = { slot, name: item.name, count: item.count };
      if (Object.keys(item.metadata).length > 0) stored.metadata = item.metadata;
      out.push(stored);
    }
    return this.orphans.length > 0 ? out.concat(this.orphans) : out;
  }
};

// src/server/inventory/manager.ts
var stashId = (name2, owner) => owner ? `${name2}:${owner}` : name2;
var InventoryManager = class {
  registry;
  deps;
  inventories = /* @__PURE__ */ new Map();
  loading = /* @__PURE__ */ new Map();
  stashes = /* @__PURE__ */ new Map();
  lastUse = /* @__PURE__ */ new Map();
  saving = null;
  /** inventarios ya descargados cuyo último guardado falló: se reintentan en saveDirty */
  pending = /* @__PURE__ */ new Set();
  constructor(deps) {
    this.deps = deps;
    this.registry = deps.registry;
    this.registry.onChange(() => {
      for (const inv of this.inventories.values()) inv.recalculateWeight();
    });
  }
  metaContext(playerName) {
    const ctx = { now: this.deps.now(), random: this.deps.random };
    if (playerName) ctx.playerName = playerName;
    return ctx;
  }
  get(id) {
    const inv = this.inventories.get(String(id));
    if (inv) this.lastUse.set(inv.id, this.deps.now());
    return inv;
  }
  /** Inventarios descargados que aún no se han podido guardar. */
  get pendingSaves() {
    return this.pending.size;
  }
  /** Todos los inventarios cargados (para la API: Search de alijos, etc.). */
  all() {
    return this.inventories.values();
  }
  // --- Jugadores ---------------------------------------------------------------
  /**
   * Carga el inventario de un personaje. Si la base de datos falla, lanza y NO
   * crea un inventario vacío: uno vacío se guardaría encima del real.
   */
  async loadPlayer(setup) {
    const id = String(setup.source);
    const previous = this.inventories.get(id);
    if (previous) await this.unloadPlayer(setup.source);
    let unsaved;
    for (const old of this.pending) {
      if (old.type === "player" && old.owner === setup.owner) {
        unsaved = old.toStored();
        this.pending.delete(old);
      }
    }
    const raw = unsaved ? JSON.stringify(unsaved) : await this.deps.store.loadPlayer(setup.owner);
    const inv = this.create({
      id,
      type: "player",
      label: setup.name,
      slots: setup.slots,
      maxWeight: setup.maxWeight,
      owner: setup.owner,
      dbId: setup.owner,
      persistent: true
    });
    inv.player = setup.source;
    this.fill(inv, raw);
    if (unsaved) inv.dirty = true;
    this.inventories.set(id, inv);
    this.deps.onActivity?.();
    return inv;
  }
  /** Guarda (si hace falta) y descarta el inventario de un jugador. */
  async unloadPlayer(source2) {
    const inv = this.inventories.get(String(source2));
    if (!inv) return;
    for (const other of this.inventories.values()) other.openedBy.delete(source2);
    this.inventories.delete(inv.id);
    inv.player = void 0;
    try {
      await this.save([inv]);
    } catch {
      this.pending.add(inv);
      this.deps.onActivity?.();
    }
  }
  // --- Alijos ------------------------------------------------------------------
  registerStash(def) {
    this.stashes.set(def.name, def);
  }
  getStashDef(name2) {
    return this.stashes.get(name2);
  }
  /**
   * Carga (o devuelve) un alijo registrado. `owner` decide de quién es el
   * alijo cuando la definición lleva owner: true.
   */
  loadStash(def, owner) {
    const realOwner = def.owner === true ? owner : typeof def.owner === "string" ? def.owner : void 0;
    if (def.owner === true && !realOwner) return Promise.reject(new Error(`el alijo ${def.name} necesita due\xF1o`));
    const id = stashId(def.name, realOwner);
    const loaded = this.get(id);
    if (loaded) return Promise.resolve(loaded);
    const pending = this.loading.get(id);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const raw = await this.deps.store.loadStash(realOwner ?? "", def.name);
        const init = {
          id,
          type: "stash",
          label: def.label,
          slots: def.slots,
          maxWeight: def.maxWeight,
          dbId: def.name,
          persistent: true
        };
        if (realOwner) init.owner = realOwner;
        if (def.groups) init.groups = def.groups;
        if (def.coords) init.coords = def.coords;
        if (def.distance !== void 0) init.distance = def.distance;
        const inv = this.create(init);
        this.fill(inv, raw);
        this.inventories.set(id, inv);
        this.deps.onActivity?.();
        this.lastUse.set(id, this.deps.now());
        return inv;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, promise);
    return promise;
  }
  /**
   * Maletero o guantera de un vehículo con dueño (se guarda en player_vehicles).
   * Misma carga compartida que los alijos.
   */
  loadVehicle(kind, id, dbId, label, slots, maxWeight) {
    const loaded = this.get(id);
    if (loaded) return Promise.resolve(loaded);
    const pending = this.loading.get(id);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const raw = await this.deps.store.loadVehicle(kind, dbId);
        const inv = this.create({ id, type: kind, label, slots, maxWeight, dbId, persistent: true });
        this.fill(inv, raw);
        this.inventories.set(id, inv);
        this.deps.onActivity?.();
        this.lastUse.set(id, this.deps.now());
        return inv;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, promise);
    return promise;
  }
  /** Inventario temporal (no se guarda): drops, alijos de un solo uso. */
  createTemporary(init, items = []) {
    const inv = this.create({ ...init, persistent: false });
    this.fill(inv, items.length > 0 ? JSON.stringify(items) : null);
    this.inventories.set(inv.id, inv);
    this.deps.onActivity?.();
    return inv;
  }
  /**
   * Descarga alijos que nadie usa desde hace `idleSeconds` y que no tienen
   * nada pendiente de guardar. Libera memoria en servidores grandes.
   */
  evictIdle(idleSeconds) {
    const limit = this.deps.now() - idleSeconds;
    let removed = 0;
    for (const inv of this.inventories.values()) {
      const storage = inv.type === "stash" || inv.type === "trunk" || inv.type === "glovebox";
      if (!storage || !inv.persistent || inv.openedBy.size > 0 || inv.dirty || inv.hasChanges()) continue;
      if ((this.lastUse.get(inv.id) ?? 0) > limit) continue;
      this.inventories.delete(inv.id);
      this.lastUse.delete(inv.id);
      removed++;
    }
    return removed;
  }
  /** Quita un inventario (temporal o no) sin guardarlo. */
  remove(id) {
    const inv = this.inventories.get(id);
    if (!inv) return void 0;
    this.inventories.delete(id);
    this.lastUse.delete(id);
    return inv;
  }
  // --- Cambios -----------------------------------------------------------------
  /**
   * Manda los cambios pendientes: al dueño (si es un jugador) y a quien lo
   * tenga abierto. Se llama al terminar cada operación.
   */
  commit() {
    const byTarget = /* @__PURE__ */ new Map();
    let changed = false;
    for (const inv of this.inventories.values()) {
      if (!inv.hasChanges()) continue;
      changed = true;
      const changes = inv.takeChanges();
      const patch = {
        inv: inv.id,
        rev: inv.rev,
        steps: 1,
        weight: inv.weight,
        slots: changes.slots.map((slot) => inv.slotView(slot))
      };
      if (changes.resized) {
        patch.maxWeight = inv.maxWeight;
        patch.slotCount = inv.slots;
      }
      const targets = new Set(inv.openedBy);
      if (inv.player !== void 0) targets.add(inv.player);
      for (const target of targets) {
        const list = byTarget.get(target);
        if (list) list.push(patch);
        else byTarget.set(target, [patch]);
      }
    }
    for (const [target, patches] of byTarget) this.deps.sendPatches(target, patches);
    if (changed) this.deps.onActivity?.();
  }
  /** Queda algo por guardar, o alijos y maleteros cargados que habrá que descargar. */
  needsMaintenance() {
    if (this.pending.size > 0) return true;
    for (const inv of this.inventories.values()) {
      if (inv.persistent && (inv.dirty || inv.type === "stash" || inv.type === "trunk" || inv.type === "glovebox")) return true;
    }
    return false;
  }
  // --- Guardado ----------------------------------------------------------------
  /** Guarda todos los inventarios con cambios, en una transacción. */
  saveDirty() {
    const dirty = [];
    for (const inv of this.inventories.values()) if (inv.persistent && inv.dirty) dirty.push(inv);
    for (const inv of this.pending) dirty.push(inv);
    return this.save(dirty).then(() => {
      for (const inv of this.pending) if (!inv.dirty) this.pending.delete(inv);
    });
  }
  /**
   * Guarda una lista de inventarios. Los guardados no se solapan: si hay uno en
   * marcha, este espera a que termine. Si falla, los inventarios siguen
   * marcados y se reintentan en el siguiente.
   */
  save(list) {
    const run = async () => {
      const batch = emptyBatch();
      const taken = [];
      for (const inv of list) {
        if (!inv.persistent || !inv.dirty) continue;
        this.addToBatch(batch, inv);
        inv.dirty = false;
        taken.push(inv);
      }
      if (batchSize(batch) === 0) return;
      try {
        await this.deps.store.save(batch);
      } catch (err) {
        for (const inv of taken) inv.dirty = true;
        this.deps.log.error(`no se pudo guardar (${taken.length} inventarios): ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    };
    const next = (this.saving ?? Promise.resolve()).then(run);
    const queued = next.then(
      () => {
        if (this.saving === queued) this.saving = null;
      },
      () => {
        if (this.saving === queued) this.saving = null;
      }
    );
    this.saving = queued;
    return next;
  }
  addToBatch(batch, inv) {
    const data = serializeItems(inv.toStored());
    switch (inv.type) {
      case "player":
        batch.players.push({ owner: inv.owner, data });
        break;
      case "stash":
        batch.stashes.push({ owner: inv.owner ?? "", name: String(inv.dbId), data });
        break;
      case "trunk":
      case "glovebox":
        batch.vehicles.push({ kind: inv.type, id: inv.dbId, data });
        break;
      default:
        break;
    }
  }
  create(init) {
    return new Inventory(init, this.registry);
  }
  fill(inv, raw) {
    const loaded = parseStoredItems(this.registry, raw, inv.slots, this.deps.now());
    inv.load(loaded.items, loaded.orphans);
    for (const problem of loaded.problems) this.deps.log.warn(`${describe(inv.type)} ${inv.id}: ${problem}`);
  }
};
function describe(type) {
  return type === "player" ? "jugador" : type;
}

// src/server/items/registry.ts
var ALIASES = { cash: "money" };
var num = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
var ItemRegistry = class {
  defs = /* @__PURE__ */ new Map();
  buttons = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  animations = { anim: {}, prop: {} };
  warn;
  constructor(warn = () => {
  }) {
    this.warn = warn;
  }
  get size() {
    return this.defs.size;
  }
  get(name2) {
    const key = normalizeItemName(name2);
    return this.defs.get(ALIASES[key] ?? key);
  }
  has(name2) {
    return this.get(name2) !== void 0;
  }
  all() {
    return this.defs.values();
  }
  setAnimations(animations) {
    this.animations = animations;
  }
  /** Carga los objetos de config/items.jsonc. */
  loadItems(items) {
    for (const [name2, config] of Object.entries(items)) this.set(this.fromConfig(name2, config), false);
  }
  /** Carga armas, accesorios y munición de config/weapons.jsonc. */
  loadWeapons(config) {
    for (const [name2, w] of Object.entries(config.weapons)) {
      const def = {
        name: name2,
        label: w.label,
        weight: num(w.weight, 0),
        // como ox: las arrojadizas se apilan y usar un arma no cierra el inventario
        stack: w.throwable === true,
        close: false,
        consume: 0,
        allowArmed: true,
        weapon: { durability: num(w.durability, 0.05) }
      };
      if (w.ammoName) def.weapon.ammoName = w.ammoName;
      if (w.throwable) def.weapon.throwable = true;
      if (w.description) def.description = w.description;
      if (w.image) def.image = w.image;
      this.set(def, false);
    }
    for (const [name2, c] of Object.entries(config.components)) {
      const def = {
        name: name2,
        label: c.label,
        weight: num(c.weight, 0),
        stack: true,
        close: false,
        consume: 1,
        allowArmed: true,
        component: { type: c.type, hashes: c.hashes }
      };
      if (c.useTime) def.useTime = c.useTime;
      if (c.description) def.description = c.description;
      if (c.image) def.image = c.image;
      this.set(def, false);
    }
    for (const [name2, a] of Object.entries(config.ammo)) {
      const def = {
        name: name2,
        label: a.label,
        weight: num(a.weight, 0),
        stack: true,
        close: true,
        consume: 0,
        allowArmed: true,
        ammo: true
      };
      if (a.description) def.description = a.description;
      this.set(def, false);
    }
  }
  /** Registro en caliente desde la API. Devuelve la definición normalizada. */
  register(name2, config) {
    const def = this.fromConfig(name2, config);
    this.set(def, true);
    return def;
  }
  /** Botones propios del menú del objeto (los registra la API; la acción vive en quien los registra). */
  setButtons(name2, labels) {
    this.buttons.set(normalizeItemName(name2), labels);
    const def = this.get(name2);
    if (def) this.emit([def]);
  }
  uiDefs() {
    const out = [];
    for (const def of this.defs.values()) out.push(toUiDef(def, this.buttons.get(def.name)));
    return out;
  }
  uiDef(def) {
    return toUiDef(def, this.buttons.get(def.name));
  }
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(def, notify) {
    if (!ITEM_NAME.test(def.name)) {
      this.warn(`objeto "${def.name}": nombre no v\xE1lido (letras, n\xFAmeros, _ y -), se ignora`);
      return;
    }
    const previous = this.defs.get(def.name);
    if (previous && !notify) {
      this.warn(`objeto "${def.name}" definido dos veces (${previous.weapon || previous.ammo || previous.component ? "arma" : "objeto"} y ${def.weapon || def.ammo || def.component ? "arma" : "objeto"}): vale la \xFAltima, la de ${def.weapon || def.ammo || def.component ? "weapons.jsonc" : "items.jsonc"}`);
    }
    this.defs.set(def.name, def);
    if (notify) this.emit([def]);
  }
  emit(defs) {
    for (const listener of this.listeners) listener(defs);
  }
  fromConfig(rawName, c) {
    const name2 = normalizeItemName(rawName);
    const def = {
      name: name2,
      label: typeof c.label === "string" ? c.label : name2,
      weight: Math.max(0, num(c.weight, 0)),
      stack: c.stack !== false,
      close: c.close !== false,
      consume: Math.min(1, Math.max(0, num(c.consume, 1))),
      allowArmed: c.allowArmed === true
    };
    if (typeof c.description === "string") def.description = c.description;
    if (typeof c.image === "string") def.image = c.image;
    if (num(c.degrade, 0) > 0) def.degrade = num(c.degrade, 0);
    if (c.decay) def.decay = true;
    if (c.useTime !== void 0) def.useTime = Math.max(0, num(c.useTime, 0));
    if (typeof c.useLabel === "string") def.useLabel = c.useLabel;
    if (c.disable) def.disable = c.disable;
    if (c.cancel) def.cancel = true;
    if (typeof c.notification === "string") def.notification = c.notification;
    if (c.status) def.status = c.status;
    if (typeof c.clientExport === "string") def.clientExport = c.clientExport;
    if (typeof c.clientEvent === "string") def.clientEvent = c.clientEvent;
    if (typeof c.serverExport === "string") def.serverExport = c.serverExport;
    if (c.weapon) def.weapon = c.weapon;
    if (c.ammo) def.ammo = true;
    if (c.component) def.component = c.component;
    if (typeof c.anim === "string") {
      const anim = this.animations.anim[c.anim];
      if (anim) def.anim = anim;
      else this.warn(`objeto "${name2}": animaci\xF3n "${c.anim}" no existe en animations.jsonc`);
    } else if (c.anim) {
      def.anim = c.anim;
    }
    if (typeof c.prop === "string") {
      const prop = this.animations.prop[c.prop];
      if (prop) def.prop = prop;
      else this.warn(`objeto "${name2}": prop "${c.prop}" no existe en animations.jsonc`);
    } else if (c.prop) {
      def.prop = c.prop;
    }
    return def;
  }
};

// src/server/persistence/oxmysql.ts
var DB_TIMEOUT_MS = 2e4;
function withTimeout(label, run) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sin respuesta de oxmysql en ${DB_TIMEOUT_MS} ms: ${label}`)), DB_TIMEOUT_MS);
    const done = (fn) => (v) => {
      clearTimeout(timer);
      fn(v);
    };
    try {
      run(done(resolve), done(reject));
    } catch (err) {
      done(reject)(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
var VEHICLE_COLUMN = { trunk: "trunk", glovebox: "glovebox" };
var SCHEMAS = {
  qbx: { playerTable: "players", playerColumn: "citizenid", vehicleTable: "player_vehicles", vehicleColumn: "id", addVehicleColumns: false, qbFields: false },
  qb: { playerTable: "players", playerColumn: "citizenid", vehicleTable: "player_vehicles", vehicleColumn: "id", addVehicleColumns: true, qbFields: true },
  esx: { playerTable: "users", playerColumn: "identifier", vehicleTable: "owned_vehicles", vehicleColumn: "plate", addVehicleColumns: true, qbFields: false }
};
function withQbFields(data) {
  if (!data) return data;
  const items = JSON.parse(data);
  return JSON.stringify(items.map((item) => ({ ...item, amount: item.count, info: item.metadata ?? {} })));
}
var CREATE_STASH_TABLE = `CREATE TABLE IF NOT EXISTS \`ox_inventory\` (
  \`owner\` varchar(60) DEFAULT NULL,
  \`name\` varchar(100) NOT NULL,
  \`data\` longtext DEFAULT NULL,
  \`lastupdated\` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  UNIQUE KEY \`owner\` (\`owner\`,\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
var OxmysqlStore = class {
  db;
  schema;
  constructor(db, schema = SCHEMAS.qbx) {
    const { query, scalar, transaction } = db;
    this.db = { query, scalar, transaction };
    this.schema = schema;
  }
  query(sql, params = []) {
    return withTimeout(
      sql.slice(0, 80),
      (resolve, reject) => this.db.query(sql, params, (result) => result === null || result === void 0 ? reject(new Error(`consulta fallida: ${sql.slice(0, 80)}`)) : resolve(result))
    );
  }
  scalar(sql, params) {
    return withTimeout(sql.slice(0, 80), (resolve) => this.db.scalar(sql, params, (result) => resolve(result ?? null)));
  }
  async init() {
    await this.query(CREATE_STASH_TABLE);
    const { playerTable, playerColumn, vehicleTable, vehicleColumn } = this.schema;
    const wanted = [`${playerTable}.${playerColumn}`, `${playerTable}.inventory`, `${vehicleTable}.${vehicleColumn}`, `${vehicleTable}.trunk`, `${vehicleTable}.glovebox`];
    const missingColumns = async () => {
      const columns = await this.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)`,
        [playerTable, vehicleTable]
      );
      const have = new Set(columns.map((c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`));
      return wanted.filter((c) => !have.has(c));
    };
    let missing = await missingColumns();
    if (this.schema.addVehicleColumns && !missing.includes(`${vehicleTable}.${vehicleColumn}`)) {
      const add = Object.values(VEHICLE_COLUMN).filter((column) => missing.includes(`${vehicleTable}.${column}`));
      for (const column of add) await this.query(`ALTER TABLE \`${vehicleTable}\` ADD COLUMN \`${column}\` LONGTEXT NULL`);
      if (add.length > 0) missing = await missingColumns();
    }
    if (missing.length > 0) throw new Error(`faltan columnas en la base de datos: ${missing.join(", ")} (\xBFest\xE1 instalado el framework?)`);
  }
  /**
   * Clave del vehículo con dueño que lleva esa matrícula (id en QBCore, la matrícula tal como
   * está guardada en ESX), o null. Las dos tablas tienen columna plate; se compara sin espacios.
   */
  async vehicleKeyByPlate(plate) {
    const { vehicleTable, vehicleColumn } = this.schema;
    const key = await this.scalar(`SELECT \`${vehicleColumn}\` FROM \`${vehicleTable}\` WHERE TRIM(plate) = TRIM(?) LIMIT 1`, [plate]);
    return typeof key === "number" || typeof key === "string" ? key : null;
  }
  /** Consulta de lectura para los adaptadores (licencias de ESX). */
  select(sql, params) {
    return this.query(sql, params);
  }
  async loadPlayer(owner) {
    const { playerTable, playerColumn } = this.schema;
    return asText(await this.scalar(`SELECT inventory FROM \`${playerTable}\` WHERE \`${playerColumn}\` = ?`, [owner]));
  }
  async loadStash(owner, name2) {
    return asText(await this.scalar("SELECT data FROM ox_inventory WHERE owner = ? AND name = ?", [owner, name2]));
  }
  async loadVehicle(kind, id) {
    const { vehicleTable, vehicleColumn } = this.schema;
    return asText(await this.scalar(`SELECT ${VEHICLE_COLUMN[kind]} FROM \`${vehicleTable}\` WHERE \`${vehicleColumn}\` = ?`, [id]));
  }
  save(batch) {
    const queries = [];
    const { playerTable, playerColumn, vehicleTable, vehicleColumn, qbFields } = this.schema;
    for (const p of batch.players) {
      const data = qbFields ? withQbFields(p.data) : p.data;
      queries.push({ query: `UPDATE \`${playerTable}\` SET inventory = ? WHERE \`${playerColumn}\` = ?`, values: [data ?? "[]", p.owner] });
    }
    for (const s of batch.stashes) {
      queries.push({
        query: "INSERT INTO ox_inventory (data, owner, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
        values: [s.data, s.owner, s.name]
      });
    }
    for (const v of batch.vehicles) {
      queries.push({ query: `UPDATE \`${vehicleTable}\` SET ${VEHICLE_COLUMN[v.kind]} = ? WHERE \`${vehicleColumn}\` = ?`, values: [v.data, v.id] });
    }
    if (queries.length === 0) return Promise.resolve();
    return withTimeout(
      `transacci\xF3n de ${queries.length} consultas`,
      (resolve, reject) => this.db.transaction(queries, (ok) => ok === true ? resolve() : reject(new Error(`la transacci\xF3n de guardado fall\xF3 (${queries.length} consultas)`)))
    );
  }
};
function asText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === void 0) return null;
  return String(value);
}

// src/server/features/interact.ts
var TARGET_DISTANCE = 3.5;
var VEHICLE_DISTANCE = 7;
var InteractFeature = class {
  deps;
  constructor(deps) {
    this.deps = deps;
  }
  vehicle(source2, req) {
    const { service, send, escort, restrained } = this.deps;
    const { world: world2, config } = service.deps;
    if (req.target === source2) throw new RpcError("invalid");
    if (!service.isAuthorized(source2)) throw new RpcError("no_access");
    if (!service.isLoaded(req.target)) throw new RpcError("not_found");
    const a = world2.pedCoords(source2);
    const b = world2.pedCoords(req.target);
    if (!a || !b || distance(a, b) > TARGET_DISTANCE + config.distanceTolerance) throw new RpcError("too_far");
    if (world2.bucket(source2) !== world2.bucket(req.target)) throw new RpcError("too_far");
    if (!restrained.some((key) => world2.playerState(req.target, key))) throw new RpcError("not_restrained");
    if (req.netId === void 0) {
      if (!world2.pedVehicle(req.target)) throw new RpcError("not_found");
      send(req.target, escort()?.remove ?? "nx_inventory:leaveVehicle");
      return "out";
    }
    const entity = world2.entityFromNetId(req.netId);
    const coords = entity ? world2.entityCoords(entity) : null;
    if (!coords) throw new RpcError("not_found");
    if (distance(a, coords) > VEHICLE_DISTANCE + config.distanceTolerance) throw new RpcError("too_far");
    send(req.target, escort()?.warp ?? "nx_inventory:warpIntoVehicle", req.netId, 2);
    return "in";
  }
};

// src/shared/origin.ts
/*! nx_inventory | Copyright (C) 2026 Nxzt1 | GPL-3.0-or-later | https://github.com/Nxzt1/nx_inventory | nxinv-605060a26b47f756 */
var ORIGIN = Object.freeze({
  name: "nx_inventory",
  author: "Nxzt1",
  repository: "https://github.com/Nxzt1/nx_inventory",
  license: "GPL-3.0-or-later",
  id: "nxinv-605060a26b47f756"
});

// src/server/origin.ts
function announceOrigin(log) {
  const resource = GetCurrentResourceName();
  const author = GetResourceMetadata(resource, "author", 0) ?? "";
  const version = GetResourceMetadata(resource, "nx_version", 0) ?? "?";
  log.info(`${ORIGIN.name} ${version} por ${ORIGIN.author} (${ORIGIN.license}) ${ORIGIN.repository}`);
  if (!author.includes(ORIGIN.author)) {
    log.warn(
      `este recurso es una copia de ${ORIGIN.name} (${ORIGIN.author}, ${ORIGIN.repository}). La licencia ${ORIGIN.license} obliga a mantener los cr\xE9ditos y a publicar el c\xF3digo de las versiones modificadas.`
    );
  }
  SetConvarServerInfo("nx_inventory", `${ORIGIN.author}/${ORIGIN.id}`);
}

// src/server/main.ts
var RESOURCE = GetCurrentResourceName();
var boot = createLogger("info");
announceOrigin(boot);
var vec = (v) => v && v.length >= 3 && v.every((n) => typeof n === "number") ? [v[0], v[1], v[2]] : null;
var world = {
  pedCoords(source2) {
    const ped = GetPlayerPed(String(source2));
    return ped ? vec(GetEntityCoords(ped)) : null;
  },
  entityFromNetId: (netId) => {
    const entity = NetworkGetEntityFromNetworkId(netId);
    return entity && DoesEntityExist(entity) ? entity : 0;
  },
  entityCoords: (entity) => DoesEntityExist(entity) ? vec(GetEntityCoords(entity)) : null,
  pedVehicle: (source2) => {
    const ped = GetPlayerPed(String(source2));
    return ped ? GetVehiclePedIsIn(ped, false) : 0;
  },
  vehiclePlate: (entity) => GetVehicleNumberPlateText(entity) ?? "",
  vehicleModel: (entity) => GetEntityModel(entity),
  vehicleLockStatus: (entity) => GetVehicleDoorLockStatus(entity),
  bucket: (source2) => GetPlayerRoutingBucket(String(source2)),
  playerState: (source2, key) => Player(source2).state[key],
  players: () => getPlayers().map(Number)
};
function start() {
  let config;
  try {
    config = loadConfig((path) => LoadResourceFile(RESOURCE, path) ?? null, boot.warn);
  } catch (err) {
    boot.error(err instanceof ConfigError ? err.message : `configuraci\xF3n: ${String(err)}`);
    return;
  }
  const lang = loadLocale((path) => LoadResourceFile(RESOURCE, path) ?? null, LOCALE_CONVARS.map((name2) => GetConvar(name2, "").trim()).find(Boolean) ?? "en");
  const general = config.general;
  const log = createLogger(general.logLevel);
  const registry = new ItemRegistry(log.warn);
  registry.setAnimations(config.animations);
  registry.loadItems(config.items);
  registry.loadWeapons(config.weapons);
  const kind = detectFramework(log.warn);
  if (kind === "qbx") checkQbxBridge(log.warn);
  const store = new OxmysqlStore(exports.oxmysql, SCHEMAS[kind]);
  const manager = new InventoryManager({
    registry,
    store,
    log,
    sendPatches: (target, patches) => emitNet(PUSH_EVENTS.patch, target, patches),
    now: () => Math.floor(Date.now() / 1e3),
    random: Math.random,
    onActivity: () => scheduleMaintenance()
  });
  const hooks = new Hooks(log.warn);
  const framework = kind === "esx" ? new EsxFramework(log, store) : kind === "qb" ? new QbFramework(log, (plate) => store.vehicleKeyByPlate(plate)) : new QbxFramework(log);
  let transfer;
  const service = new InventoryService({
    manager,
    framework,
    hooks,
    log,
    world,
    config: {
      playerSlots: general.playerSlots,
      playerMaxWeight: general.playerMaxWeight,
      stashDistance: general.stashDistance,
      distanceTolerance: general.distanceTolerance,
      frameworkSyncDelay: general.frameworkSyncDelay,
      policeGroups: general.policeGroups,
      authorizedGroups: general.authorizedGroups,
      authorizeGangs: general.authorizeGangs
    },
    sendSetup: (target, inventory) => {
      emitNet(PUSH_EVENTS.setup, target, { inventory, items: registry.uiDefs() });
      emitNet(PUSH_EVENTS.drops, target, { add: transfer.dropsFor(target) });
    },
    sendOpen: (target, left, right) => emitNet(PUSH_EVENTS.open, target, { left, right }),
    sendClose: (target) => emitNet(PUSH_EVENTS.close, target),
    sendLogout: (target) => emitNet(PUSH_EVENTS.logout, target)
  });
  for (const stash of config.stashes) manager.registerStash(stash);
  const use = new UseFeature({
    service,
    now: () => Date.now(),
    callServerExport(ref, event, def, inventoryId, slot) {
      const [resource, fn] = ref.split(".");
      if (!resource || !fn) return void 0;
      try {
        return exports[resource][fn](event, def, inventoryId, slot);
      } catch (err) {
        log.error(`export ${ref} (${event}): ${err instanceof Error ? err.message : String(err)}`);
        return void 0;
      }
    },
    emitUsed(source2, name2, slot, metadata) {
      emit("nx_inventory:usedItem", source2, name2, slot, metadata);
      emit("ox_inventory:usedItem", source2, name2, slot, metadata);
    }
  });
  transfer = new TransferFeature({
    service,
    config: {
      giveDistance: general.giveDistance,
      searchDistance: general.searchDistance,
      dropSlots: general.dropSlots,
      dropMaxWeight: general.dropMaxWeight,
      dropMergeDistance: general.dropMergeDistance,
      dropModel: general.dropModel
    },
    sendDrops: (targets, add, remove) => {
      for (const target of targets) emitNet(PUSH_EVENTS.drops, target, { add, remove });
    },
    sendDropOpened: (target, drop) => emitNet(PUSH_EVENTS.dropOpened, target, drop)
  });
  const shops = new ShopFeature(service);
  for (const [type, shop] of Object.entries(config.shops)) shops.register(type, shop);
  new VehicleFeature({
    service,
    config: config.vehicles,
    loot: general.vehicleLoot,
    hash: (name2) => GetHashKey(name2),
    random: Math.random,
    trimPlate: general.trimPlate
  });
  const weapons = new WeaponFeature(service);
  const api = new ServerApi({ service, hooks, log });
  const methods = [
    "getItemDef",
    "getItemDefs",
    "registerItem",
    "addItem",
    "removeItem",
    "setItem",
    "canCarry",
    "clearInventory",
    "getItemCount",
    "search",
    "getSlot",
    "getInventory",
    "setMetadata",
    "setDurability",
    "registerStash",
    "registerHook",
    "removeHooks",
    "openFor"
  ];
  for (const method of methods) exports(method, api[method].bind(api));
  exports("registerShop", (type, shop) => shops.register(type, shop));
  exports("about", () => ({ ...ORIGIN }));
  exports("isAuthorized", (source2) => service.isAuthorized(Number(source2)));
  registerOxCompat({ api, service, shops, transfer, log, on: (event, handler) => on(event, handler) });
  if (kind === "qb") registerQbCompat({ api, service, shops, on: (event, handler) => on(event, handler) });
  registry.onChange((defs) => emitNet(PUSH_EVENTS.items, -1, defs.map((def) => registry.uiDef(def))));
  const rpc = new RpcServer({ reply: (target, result) => emitNet(RPC_RESULT_EVENT, target, result), now: () => Date.now() }, log);
  rpc.handle("open", (s, a) => service.open(s, a), { mutating: true });
  rpc.handle("close", (s) => service.close(s), { mutating: false });
  rpc.handle("move", (s, a) => service.move(s, a), { mutating: true });
  rpc.handle("resync", (s, a) => service.resync(s, a), { mutating: false });
  rpc.handle("use", (s, a) => use.use(s, a), { mutating: true });
  rpc.handle("useDone", (s, a) => use.useDone(s, a), { mutating: true });
  rpc.handle("give", (s, a) => transfer.give(s, a), { mutating: true });
  rpc.handle("drop", (s, a) => transfer.drop(s, a), { mutating: true });
  rpc.handle("buy", (s, a) => shops.buy(s, a), { mutating: true });
  rpc.handle("updateWeapon", (s, a) => weapons.update(s, a), { mutating: true });
  rpc.handle("reload", (s, a) => weapons.reload(s, a), { mutating: true });
  rpc.handle("throw", (s) => weapons.throw(s), { mutating: true });
  rpc.handle("addComponent", (s, a) => weapons.addComponent(s, a), { mutating: true });
  rpc.handle("removeComponent", (s, a) => weapons.removeComponent(s, a), { mutating: true });
  rpc.handle("removeAmmo", (s, a) => weapons.removeAmmo(s, a), { mutating: true });
  rpc.handle("disarm", (s) => weapons.disarm(s), { mutating: false });
  const interact = new InteractFeature({
    service,
    send: (target, event, ...args) => emitNet(event, target, ...args),
    escort: () => {
      const { escortResource, escortWarpEvent, escortRemoveEvent } = general.integrations;
      return escortResource && escortWarpEvent && escortRemoveEvent && GetResourceState(escortResource) === "started" ? { warp: escortWarpEvent, remove: escortRemoveEvent } : null;
    },
    restrained: general.integrations.restrainedStates
  });
  rpc.handle("vehicle", (s, a) => interact.vehicle(s, a), { mutating: false });
  const publishGroups = (src) => {
    const info = service.playerInfo(src);
    if (!info) return;
    Player(src).state.set("nxGroups", info.groups, true);
    Player(src).state.set("nxAuthorized", service.isAuthorized(src), true);
  };
  let ready = false;
  onNet(RPC_EVENT, (raw) => {
    const src = Number(source);
    if (!ready || !src) return;
    void rpc.receive(src, raw);
  });
  const diagAt = /* @__PURE__ */ new Map();
  onNet("nx_inventory:diag", () => {
    const src = Number(source);
    if (!src || Date.now() - (diagAt.get(src) ?? 0) < 5e3) return;
    diagAt.set(src, Date.now());
    const reply = (lines2) => {
      log.info(`diagn\xF3stico de ${src}: ${lines2.join(" | ")}`);
      emitNet("nx_inventory:diag", src, lines2);
    };
    const lines = [`servidor listo=${ready}${dbError ? ` (error de base de datos: ${dbError})` : ""}`, `inventario en el servidor=${manager.get(String(src)) ? "s\xED" : "no"}`, `loadInventory=${String(Player(src).state.loadInventory)}`];
    let info = null;
    try {
      info = framework.getPlayer(src);
      lines.push(`personaje en ${framework.name}=${info ? info.owner : "no"}`);
    } catch (err) {
      lines.push(`${framework.name} getPlayer fall\xF3: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (ready && info) {
      const loaded = info;
      lines.push("cargando el inventario otra vez\u2026");
      reply(lines);
      service.playerLoaded(loaded).then(() => {
        publishGroups(src);
        reply([`cargado: ${manager.get(String(src)) ? "s\xED" : "no"}`]);
      }).catch((err) => reply([`error al cargar: ${err instanceof Error ? err.message : String(err)}`]));
      return;
    }
    reply(lines);
  });
  on("playerDropped", () => {
    const src = Number(source);
    rpc.forget(src);
    use.forget(src);
    service.playerLogout(src).catch(() => {
    });
  });
  on("onResourceStop", (name2) => {
    if (name2 !== RESOURCE) hooks.remove(name2);
  });
  const saveAll = (reason) => manager.saveDirty().catch((err) => log.error(`guardado (${reason}) fallido: ${err instanceof Error ? err.message : String(err)}`));
  let maintenance = null;
  function scheduleMaintenance() {
    if (maintenance !== null || !ready) return;
    maintenance = setTimeout(() => {
      void saveAll("peri\xF3dico").finally(() => {
        manager.evictIdle(general.stashIdleMinutes * 60);
        transfer.sweep();
        maintenance = null;
        if (manager.needsMaintenance() || transfer.count > 0) scheduleMaintenance();
      });
    }, general.saveInterval * 1e3);
  }
  on("onResourceStop", (name2) => {
    if (name2 !== RESOURCE) return;
    if (maintenance !== null) clearTimeout(maintenance);
    void saveAll("parada del recurso");
  });
  on("txAdmin:events:serverShuttingDown", () => void saveAll("apagado del servidor"));
  let dbError = "";
  const connect = () => {
    store.init().then(() => {
      dbError = "";
      ready = true;
      framework.start({
        loaded: (info) => void service.playerLoaded(info).then(() => publishGroups(info.source)),
        logout: (src) => {
          use.forget(src);
          void service.playerLogout(src).catch(() => {
          });
        },
        groupChanged: (src, group, grade) => {
          service.groupChanged(src, group, grade);
          publishGroups(src);
        },
        accountChanged: (src, item, amount) => service.accountChanged(src, item, amount),
        importItems: (items) => {
          const fresh = Object.fromEntries(Object.entries(items).filter(([name2]) => !registry.has(name2)));
          registry.loadItems(fresh);
          if (Object.keys(fresh).length > 0) log.info(`${Object.keys(fresh).length} objetos a\xF1adidos desde ${framework.name}`);
        }
      });
      scheduleMaintenance();
      log.info(`listo: ${registry.size} objetos, ${config.stashes.length} alijos, ${Object.keys(config.shops).length} tiendas, framework ${framework.name}, idioma ${lang}`);
    }).catch((err) => {
      dbError = err instanceof Error ? err.message : String(err);
      log.error(`base de datos: ${dbError}. Se reintenta en 15 s; mientras, el inventario no atiende peticiones.`);
      setTimeout(connect, 15e3);
    });
  };
  connect();
}
start();
