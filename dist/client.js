(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };
  var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);

  // src/shared/rpc.ts
  function canApplyPatch(currentRev, patch) {
    return patch.steps > 0 && patch.rev === currentRev + patch.steps;
  }
  var RPC_EVENT, RPC_RESULT_EVENT, RPC_TIMEOUT_MS, PUSH_EVENTS;
  var init_rpc = __esm({
    "src/shared/rpc.ts"() {
      RPC_EVENT = "nx_inventory:rpc";
      RPC_RESULT_EVENT = "nx_inventory:rpcResult";
      RPC_TIMEOUT_MS = 1e4;
      PUSH_EVENTS = {
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
    }
  });

  // src/shared/personal.ts
  var PERSONAL_ID;
  var init_personal = __esm({
    "src/shared/personal.ts"() {
      PERSONAL_ID = /^[A-Za-z0-9_]{1,32}$/;
    }
  });

  // src/shared/types.ts
  function normalizeItemName(name) {
    const lower = name.toLowerCase();
    return lower.startsWith("weapon_") ? name.toUpperCase() : lower;
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
  var FUEL_LIKE_WEAPONS, ERROR_CODES;
  var init_types = __esm({
    "src/shared/types.ts"() {
      FUEL_LIKE_WEAPONS = [
        "WEAPON_PETROLCAN",
        "WEAPON_HAZARDCAN",
        "WEAPON_FERTILIZERCAN",
        "WEAPON_FIREEXTINGUISHER"
      ];
      ERROR_CODES = [
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
    }
  });

  // src/shared/validate.ts
  function parseSlotRef(value) {
    if (!isRecord(value) || !isInvId(value.inv) || !isSlot(value.slot)) return null;
    return { inv: value.inv, slot: value.slot };
  }
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
  var INV_ID, ITEM_NAME, LIMITS, isRecord, isInt, isSlot, isCount, isInvId, isItemName, parseUse, parseDrop, parseButton, parseComponent, PERSONAL_ACTION, isUnit, NUI_PARSERS, NUI_NO_ARGS;
  var init_validate = __esm({
    "src/shared/validate.ts"() {
      init_personal();
      init_types();
      INV_ID = /^[A-Za-z0-9_:.\-]{1,64}$/;
      ITEM_NAME = /^[A-Za-z0-9_\-]{1,64}$/;
      LIMITS = {
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
      isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
      isInt = (value, min, max) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
      isSlot = (value) => isInt(value, 1, LIMITS.slot);
      isCount = (value) => isInt(value, 1, LIMITS.count);
      isInvId = (value) => typeof value === "string" && INV_ID.test(value);
      isItemName = (value) => typeof value === "string" && ITEM_NAME.test(value);
      parseUse = (v) => isRecord(v) && isSlot(v.slot) ? { slot: v.slot } : null;
      parseDrop = (v) => isRecord(v) && isSlot(v.slot) && isCount(v.count) ? { slot: v.slot, count: v.count } : null;
      parseButton = (v) => isRecord(v) && isSlot(v.slot) && isInt(v.button, 0, LIMITS.buttons - 1) ? { slot: v.slot, button: v.button } : null;
      parseComponent = (v) => isRecord(v) && isSlot(v.slot) && isItemName(v.component) ? { slot: v.slot, component: v.component } : null;
      PERSONAL_ACTION = /^(clothes|action):[A-Za-z0-9_]{1,32}$/;
      isUnit = (value) => typeof value === "number" && value >= 0 && value <= 1;
      NUI_PARSERS = {
        ready: () => null,
        close: () => null,
        move: parseMove,
        use: parseUse,
        give: (v) => {
          if (!isRecord(v) || !isSlot(v.slot) || !isCount(v.count)) return null;
          if (v.target === void 0) return { slot: v.slot, count: v.count };
          return isInt(v.target, 1, LIMITS.playerId) ? { slot: v.slot, count: v.count, target: v.target } : null;
        },
        drop: parseDrop,
        buy: parseBuy,
        button: parseButton,
        removeComponent: parseComponent,
        removeAmmo: parseUse,
        targetAt: (v) => isRecord(v) && isUnit(v.x) && isUnit(v.y) ? { x: v.x, y: v.y } : null,
        personalGet: (v) => isRecord(v) && v.definitions === true ? { definitions: true } : {},
        resync: (v) => isRecord(v) && isInvId(v.inv) ? { inv: v.inv } : null,
        personalRun: (v) => isRecord(v) && typeof v.action === "string" && PERSONAL_ACTION.test(v.action) ? { action: v.action } : null
      };
      NUI_NO_ARGS = /* @__PURE__ */ new Set(["ready", "close"]);
    }
  });

  // src/shared/jsonc.ts
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
        const start = i;
        i++;
        while (i < text2.length && text2[i] !== '"') {
          if (text2[i] === "\\") i++;
          if (text2[i] === "\n") {
            const [line, column] = position(text2, start);
            throw new JsoncError("cadena sin cerrar", line, column);
          }
          i++;
        }
        if (i >= text2.length) {
          const [line, column] = position(text2, start);
          throw new JsoncError("cadena sin cerrar", line, column);
        }
        out += text2.slice(start, i + 1);
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
        const start = i;
        const end = text2.indexOf("*/", i + 2);
        if (end === -1) {
          const [line, column] = position(text2, start);
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
  var JsoncError;
  var init_jsonc = __esm({
    "src/shared/jsonc.ts"() {
      JsoncError = class extends Error {
        constructor(message, line, column) {
          super(`${message} (l\xEDnea ${line}, columna ${column})`);
          __publicField(this, "line");
          __publicField(this, "column");
          this.name = "JsoncError";
          this.line = line;
          this.column = column;
        }
      };
    }
  });

  // src/server/core/config.ts
  function readJsonc(read3, path) {
    const content = read3(path);
    if (content === null) throw new ConfigError(`falta ${path}`);
    try {
      return parseJsonc(content);
    } catch (err) {
      throw new ConfigError(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  function parseGeneral(raw, warn2) {
    const config3 = structuredCloneSafe(DEFAULT_CONFIG);
    if (!isRecord(raw)) throw new ConfigError("config/config.jsonc: debe ser un objeto");
    for (const [key2, value] of Object.entries(raw)) {
      const rule = RULES[key2];
      if (!rule) {
        warn2(`config.jsonc: "${key2}" no existe, se ignora`);
        continue;
      }
      const clean = rule(value);
      if (clean === void 0) warn2(`config.jsonc: "${key2}" no es v\xE1lido; se usa ${JSON.stringify(DEFAULT_CONFIG[key2])}`);
      else config3[key2] = clean;
    }
    return config3;
  }
  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }
  var DEFAULT_CONFIG, number, integer, boolean, text, oneOf, texts, integers, RULES, ConfigError;
  var init_config = __esm({
    "src/server/core/config.ts"() {
      init_jsonc();
      init_validate();
      DEFAULT_CONFIG = {
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
      number = (min, max) => (v) => typeof v === "number" && v >= min && v <= max ? v : void 0;
      integer = (min, max) => (v) => Number.isInteger(v) && v >= min && v <= max ? v : void 0;
      boolean = (v) => typeof v === "boolean" ? v : void 0;
      text = (v) => typeof v === "string" && v.length > 0 ? v : void 0;
      oneOf = (...values) => (v) => typeof v === "string" && values.includes(v) ? v : void 0;
      texts = (v) => Array.isArray(v) && v.every((s) => typeof s === "string") ? v : void 0;
      integers = (v) => Array.isArray(v) && v.every((n) => Number.isInteger(n)) ? v : void 0;
      RULES = {
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
          for (const [key2, value] of Object.entries(v)) {
            if (!(key2 in out)) return void 0;
            if (key2 === "restrainedStates") {
              if (!Array.isArray(value) || !value.every((s) => typeof s === "string")) return void 0;
              out.restrainedStates = value;
            } else if (typeof value === "string") out[key2] = value;
            else return void 0;
          }
          return out;
        }
      };
      ConfigError = class extends Error {
      };
    }
  });

  // src/server/items/registry.ts
  var ALIASES, num, ItemRegistry;
  var init_registry = __esm({
    "src/server/items/registry.ts"() {
      init_types();
      init_validate();
      ALIASES = { cash: "money" };
      num = (value, fallback2) => typeof value === "number" && Number.isFinite(value) ? value : fallback2;
      ItemRegistry = class {
        constructor(warn2 = () => {
        }) {
          __publicField(this, "defs", /* @__PURE__ */ new Map());
          __publicField(this, "buttons", /* @__PURE__ */ new Map());
          __publicField(this, "listeners", /* @__PURE__ */ new Set());
          __publicField(this, "animations", { anim: {}, prop: {} });
          __publicField(this, "warn");
          this.warn = warn2;
        }
        get size() {
          return this.defs.size;
        }
        get(name) {
          const key2 = normalizeItemName(name);
          return this.defs.get(ALIASES[key2] ?? key2);
        }
        has(name) {
          return this.get(name) !== void 0;
        }
        all() {
          return this.defs.values();
        }
        setAnimations(animations) {
          this.animations = animations;
        }
        /** Carga los objetos de config/items.jsonc. */
        loadItems(items2) {
          for (const [name, config3] of Object.entries(items2)) this.set(this.fromConfig(name, config3), false);
        }
        /** Carga armas, accesorios y munición de config/weapons.jsonc. */
        loadWeapons(config3) {
          for (const [name, w] of Object.entries(config3.weapons)) {
            const def = {
              name,
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
          for (const [name, c] of Object.entries(config3.components)) {
            const def = {
              name,
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
          for (const [name, a] of Object.entries(config3.ammo)) {
            const def = {
              name,
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
        register(name, config3) {
          const def = this.fromConfig(name, config3);
          this.set(def, true);
          return def;
        }
        /** Botones propios del menú del objeto (los registra la API; la acción vive en quien los registra). */
        setButtons(name, labels) {
          this.buttons.set(normalizeItemName(name), labels);
          const def = this.get(name);
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
        set(def, notify2) {
          if (!ITEM_NAME.test(def.name)) {
            this.warn(`objeto "${def.name}": nombre no v\xE1lido (letras, n\xFAmeros, _ y -), se ignora`);
            return;
          }
          const previous = this.defs.get(def.name);
          if (previous && !notify2) {
            this.warn(`objeto "${def.name}" definido dos veces (${previous.weapon || previous.ammo || previous.component ? "arma" : "objeto"} y ${def.weapon || def.ammo || def.component ? "arma" : "objeto"}): vale la \xFAltima, la de ${def.weapon || def.ammo || def.component ? "weapons.jsonc" : "items.jsonc"}`);
          }
          this.defs.set(def.name, def);
          if (notify2) this.emit([def]);
        }
        emit(defs) {
          for (const listener of this.listeners) listener(defs);
        }
        fromConfig(rawName, c) {
          const name = normalizeItemName(rawName);
          const def = {
            name,
            label: typeof c.label === "string" ? c.label : name,
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
            else this.warn(`objeto "${name}": animaci\xF3n "${c.anim}" no existe en animations.jsonc`);
          } else if (c.anim) {
            def.anim = c.anim;
          }
          if (typeof c.prop === "string") {
            const prop = this.animations.prop[c.prop];
            if (prop) def.prop = prop;
            else this.warn(`objeto "${name}": prop "${c.prop}" no existe en animations.jsonc`);
          } else if (c.prop) {
            def.prop = c.prop;
          }
          return def;
        }
      };
    }
  });

  // src/client/inventory/state.ts
  var InventoryState;
  var init_state = __esm({
    "src/client/inventory/state.ts"() {
      init_rpc();
      InventoryState = class {
        constructor(requestResync) {
          __publicField(this, "views", /* @__PURE__ */ new Map());
          __publicField(this, "resyncing", /* @__PURE__ */ new Set());
          __publicField(this, "requestResync");
          __publicField(this, "listeners", /* @__PURE__ */ new Set());
          __publicField(this, "playerId", null);
          this.requestResync = requestResync;
        }
        get(id) {
          return this.views.get(id);
        }
        get player() {
          return this.playerId ? this.views.get(this.playerId) : void 0;
        }
        setPlayer(view) {
          this.playerId = view.id;
          this.views.set(view.id, view);
        }
        /** Inventario completo (open o resync): sustituye al que hubiera. */
        set(view) {
          this.views.set(view.id, view);
          this.resyncing.delete(view.id);
        }
        /** Olvida un secundario cerrado (el propio no se olvida nunca). */
        drop(id) {
          if (id !== this.playerId) this.views.delete(id);
        }
        clear() {
          this.views.clear();
          this.resyncing.clear();
          this.playerId = null;
        }
        onChange(listener) {
          this.listeners.add(listener);
          return () => this.listeners.delete(listener);
        }
        /** Aplica parches del servidor. Devuelve los aplicados (para reenviarlos a la NUI). */
        applyPatches(patches) {
          const applied = [];
          for (const patch of patches) {
            const view = this.views.get(patch.inv);
            if (!view || this.resyncing.has(patch.inv)) continue;
            if (!canApplyPatch(view.rev, patch)) {
              this.resync(patch.inv);
              continue;
            }
            const bySlot = new Map(view.items.map((item) => [item.slot, item]));
            for (const slot of patch.slots) {
              if (slot.name === "") bySlot.delete(slot.slot);
              else bySlot.set(slot.slot, slot);
            }
            view.items = [...bySlot.values()].sort((a, b) => a.slot - b.slot);
            view.rev = patch.rev;
            view.weight = patch.weight;
            if (patch.maxWeight !== void 0) view.maxWeight = patch.maxWeight;
            if (patch.slotCount !== void 0) view.slots = patch.slotCount;
            applied.push(patch);
          }
          if (applied.length > 0) for (const listener of this.listeners) listener(applied);
          return applied;
        }
        resync(id) {
          this.resyncing.add(id);
          void this.requestResync(id).then((view) => {
            if (view && this.views.has(id)) this.set(view);
            else this.resyncing.delete(id);
          });
        }
      };
    }
  });

  // src/client/network/rpc.ts
  var RpcClient;
  var init_rpc2 = __esm({
    "src/client/network/rpc.ts"() {
      init_rpc();
      init_types();
      init_validate();
      RpcClient = class {
        constructor(send, timeoutMs = RPC_TIMEOUT_MS) {
          __publicField(this, "nextId", 1);
          __publicField(this, "pending", /* @__PURE__ */ new Map());
          __publicField(this, "send");
          __publicField(this, "timeoutMs");
          this.send = send;
          this.timeoutMs = timeoutMs;
        }
        call(op, args) {
          const id = this.nextId;
          this.nextId = this.nextId >= 2 ** 31 - 1 ? 1 : this.nextId + 1;
          return new Promise((resolve) => {
            const timer = setTimeout(() => {
              this.pending.delete(id);
              resolve({ ok: false, error: "timeout" });
            }, this.timeoutMs);
            this.pending.set(id, { resolve, timer });
            this.send({ id, op, args });
          });
        }
        /** Respuesta del servidor (evento RPC_RESULT_EVENT). */
        receive(raw) {
          if (!isRecord(raw) || !isInt(raw.id, 0, 2 ** 31 - 1)) return;
          const pending = this.pending.get(raw.id);
          if (!pending) return;
          this.pending.delete(raw.id);
          clearTimeout(pending.timer);
          const result = raw;
          if (result.ok === true) pending.resolve({ ok: true, data: result.data });
          else pending.resolve({ ok: false, error: ERROR_CODES.includes(result.error) ? result.error : "internal" });
        }
        /** Cancela todo (logout, parada del recurso). */
        cancelAll() {
          for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.resolve({ ok: false, error: "timeout" });
            this.pending.delete(id);
          }
        }
        get inFlight() {
          return this.pending.size;
        }
      };
    }
  });

  // src/shared/locale.ts
  function loadLocale(read3, wanted) {
    const lang = /^[a-z]{2}(-[a-z]{2})?$/i.test(wanted) ? wanted.toLowerCase() : "en";
    for (const key2 of Object.keys(locale)) delete locale[key2];
    Object.assign(locale, readTexts(read3, "en") ?? {});
    if (lang === "en") return "en";
    const texts2 = readTexts(read3, lang);
    if (!texts2) return "en";
    Object.assign(locale, texts2);
    return lang;
  }
  var LOCALE_CONVARS, locale, t, readTexts;
  var init_locale = __esm({
    "src/shared/locale.ts"() {
      init_jsonc();
      LOCALE_CONVARS = ["nx_inventory:locale", "ox:locale"];
      locale = {};
      t = (key2, fallback2) => locale[key2] ?? fallback2;
      readTexts = (read3, lang) => {
        const content = read3(`locales/${lang}.json`);
        if (content === null) return null;
        try {
          return parseJsonc(content);
        } catch {
          return null;
        }
      };
    }
  });

  // src/client/lib/game.ts
  function coordsOf(entity) {
    const [x, y, z] = GetEntityCoords(entity, true);
    return [x ?? 0, y ?? 0, z ?? 0];
  }
  async function waitFor(check3, timeout, step = 25) {
    const end = GetGameTimer() + timeout;
    while (GetGameTimer() < end) {
      if (check3()) return true;
      await wait(step);
    }
    return check3();
  }
  async function loadAnimDict(dict, timeout = 1500) {
    if (!DoesAnimDictExist(dict)) return false;
    RequestAnimDict(dict);
    return waitFor(() => HasAnimDictLoaded(dict), timeout);
  }
  async function loadModel(model, timeout = 3e3) {
    if (!IsModelValid(model) && !IsModelInCdimage(model)) return false;
    RequestModel(model);
    return waitFor(() => HasModelLoaded(model), timeout);
  }
  async function playAnim(dict, clip, duration, flag, blendIn = 8, blendOut = 1) {
    if (!await loadAnimDict(dict)) return;
    TaskPlayAnim(ped(), dict, clip, blendIn, blendOut, duration, flag, 0, false, false, false);
    RemoveAnimDict(dict);
  }
  function notify(description, type = "error") {
    const resource = config.integrations.notify;
    if (started(resource)) {
      exports[resource].show({ description, type });
      return;
    }
    BeginTextCommandThefeedPost("STRING");
    AddTextComponentSubstringPlayerName(description);
    EndTextCommandThefeedPostTicker(false, false);
  }
  function progressShow(label, duration) {
    const resource = config.integrations.progress;
    if (started(resource)) exports[resource].show({ label, duration, resource: "nx_inventory" });
  }
  function progressHide(cancelled) {
    const resource = config.integrations.progress;
    if (started(resource)) exports[resource].hide(cancelled);
  }
  function nearbyPlayers(origin, radius) {
    const out = [];
    const self = PlayerId();
    for (const id of GetActivePlayers()) {
      if (id === self) continue;
      const other = GetPlayerPed(id);
      if (!DoesEntityExist(other)) continue;
      const coords = coordsOf(other);
      if (dist(origin, coords) <= radius) out.push({ id, serverId: GetPlayerServerId(id), ped: other, coords });
    }
    return out.sort((a, b) => dist(origin, a.coords) - dist(origin, b.coords));
  }
  async function raycast(flags2, distance = 5, from, to) {
    let start = from;
    let end = to;
    if (!start || !end) {
      const cam = GetFinalRenderedCamCoord();
      const rot = GetFinalRenderedCamRot(2);
      const rx = (rot[0] ?? 0) * Math.PI / 180;
      const rz = (rot[2] ?? 0) * Math.PI / 180;
      const dir = [-Math.sin(rz) * Math.abs(Math.cos(rx)), Math.cos(rz) * Math.abs(Math.cos(rx)), Math.sin(rx)];
      start = [cam[0] ?? 0, cam[1] ?? 0, cam[2] ?? 0];
      end = [start[0] + dir[0] * distance, start[1] + dir[1] * distance, start[2] + dir[2] * distance];
    }
    const handle = StartShapeTestLosProbe(start[0], start[1], start[2], end[0], end[1], end[2], flags2, ped(), 4);
    for (let i = 0; i < 40; i++) {
      const [status, hit, , , entity] = GetShapeTestResult(handle);
      if (status !== 1) {
        if (!hit || !entity) return null;
        return { entity, type: GetEntityType(entity) };
      }
      await wait(0);
    }
    return null;
  }
  var wait, ped, dist, hash, started;
  var init_game = __esm({
    "src/client/lib/game.ts"() {
      init_context();
      init_locale();
      wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      ped = () => PlayerPedId();
      dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      hash = (name) => typeof name === "number" ? name : GetHashKey(name);
      started = (resource) => resource !== "" && GetResourceState(resource) === "started";
    }
  });

  // src/client/nui.ts
  function sendNui(message) {
    SendNuiMessage(JSON.stringify(message));
  }
  function onNui(name, handler) {
    RegisterNuiCallbackType(name);
    on(`__cfx_nui:${name}`, async (raw, cb) => {
      const parsed = NUI_NO_ARGS.has(name) ? null : NUI_PARSERS[name](raw);
      if (parsed === null && !NUI_NO_ARGS.has(name)) return cb(FAIL[name]);
      try {
        cb(await handler(parsed));
      } catch (err) {
        console.log(`^1[nx_inventory] NUI ${name}: ${err instanceof Error ? err.message : String(err)}^7`);
        cb(FAIL[name]);
      }
    });
  }
  var invalid, FAIL;
  var init_nui = __esm({
    "src/client/nui.ts"() {
      init_validate();
      invalid = { ok: false, error: "invalid" };
      FAIL = {
        ready: true,
        close: true,
        move: invalid,
        use: invalid,
        give: invalid,
        drop: invalid,
        buy: invalid,
        button: invalid,
        removeComponent: invalid,
        removeAmmo: invalid,
        targetAt: { target: null },
        personalGet: { states: {} },
        personalRun: { ok: false },
        resync: null
      };
    }
  });

  // src/client/context.ts
  function explain(error) {
    if (error === "busy" || error === "stale") return;
    notify(t(`error_${error}`, t("error_internal", "Error del inventario")));
  }
  async function call(op, args) {
    const result = await rpc.call(op, args);
    if (!result.ok) explain(result.error);
    return result;
  }
  var RESOURCE, read, warn, config, registry, personalConfig, rpc, state, player, flags;
  var init_context = __esm({
    "src/client/context.ts"() {
      init_config();
      init_registry();
      init_rpc();
      init_state();
      init_rpc2();
      init_game();
      init_locale();
      init_nui();
      RESOURCE = GetCurrentResourceName();
      read = (path) => LoadResourceFile(RESOURCE, path) ?? null;
      warn = (message) => console.log(`^3[nx_inventory] ${message}^7`);
      config = parseGeneral(readJsonc(read, "config/config.jsonc"), warn);
      registry = new ItemRegistry(warn);
      registry.setAnimations(readJsonc(read, "config/animations.jsonc"));
      registry.loadItems(readJsonc(read, "config/items.jsonc"));
      registry.loadWeapons(readJsonc(read, "config/weapons.jsonc"));
      personalConfig = readJsonc(read, "config/personal.jsonc");
      loadLocale(read, LOCALE_CONVARS.map((name) => GetConvar(name, "").trim()).find(Boolean) ?? "en");
      rpc = new RpcClient((payload) => emitNet(RPC_EVENT, payload));
      state = new InventoryState(async (inv) => {
        const result = await rpc.call("resync", { inv });
        if (!result.ok) return null;
        sendNui({ action: "inventory", data: result.data });
        return result.data;
      });
      player = {
        /** el servidor ha mandado el inventario (setup) */
        loaded: false,
        /** inventario abierto (la NUI tiene el foco) */
        open: false,
        /** id del secundario abierto */
        right: null,
        /** usando un objeto (barra en curso) */
        using: false,
        dead: false
      };
      flags = {
        busy: () => LocalPlayer.state.invBusy === true,
        hotkeys: () => LocalPlayer.state.invHotkeys !== false,
        weapons: () => LocalPlayer.state.canUseWeapons !== false
      };
    }
  });

  // src/client/lib/progress.ts
  async function attachProps(props) {
    const created = [];
    const self = ped();
    const [x, y, z] = coordsOf(self);
    for (const prop of props) {
      const model = hash(prop.model);
      if (!await loadModel(model)) continue;
      const object = CreateObject(model, x, y, z + 0.2, true, true, false);
      AttachEntityToEntity(
        object,
        self,
        GetPedBoneIndex(self, prop.bone),
        prop.pos[0],
        prop.pos[1],
        prop.pos[2],
        prop.rot[0],
        prop.rot[1],
        prop.rot[2],
        true,
        true,
        false,
        true,
        1,
        true
      );
      SetModelAsNoLongerNeeded(model);
      created.push(object);
    }
    return created;
  }
  async function runProgress(options) {
    if (active) return false;
    active = true;
    const self = ped();
    const disable = { combat: true, ...options.disable };
    const blocked = [];
    for (const [group, on2] of Object.entries(disable)) if (on2) blocked.push(...CONTROLS[group]);
    let dict;
    if (options.anim && await loadAnimDict(options.anim.dict)) {
      dict = options.anim.dict;
      TaskPlayAnim(self, dict, options.anim.clip, options.anim.blendIn ?? 3, options.anim.blendOut ?? 1, -1, options.anim.flag ?? 49, 0, false, false, false);
    }
    const props = options.prop ? await attachProps(Array.isArray(options.prop) ? options.prop : [options.prop]) : [];
    progressShow(options.label, options.duration);
    const cancelled = await new Promise((resolve) => {
      const done = (value) => {
        removeEventListener("nx_inventory:progressDone", done);
        resolve(value === true);
      };
      on("nx_inventory:progressDone", done);
      emit("nx_inventory:progress", { controls: blocked, combat: disable.combat === true, cancel: options.cancel === true, duration: options.duration });
    });
    if (dict && options.anim) {
      StopAnimTask(self, dict, options.anim.clip, 1);
      RemoveAnimDict(dict);
    }
    for (const object of props) {
      if (DoesEntityExist(object)) {
        DetachEntity(object, true, true);
        DeleteEntity(object);
      }
    }
    progressHide(cancelled);
    active = false;
    return !cancelled;
  }
  var active, progressActive, CONTROLS;
  var init_progress = __esm({
    "src/client/lib/progress.ts"() {
      init_game();
      active = false;
      progressActive = () => active;
      CONTROLS = {
        move: [21, 30, 31, 36],
        car: [63, 64, 71, 72, 75],
        combat: [24, 25, 37, 47, 58, 140, 141, 142, 143, 263, 264, 257],
        mouse: [1, 2, 106],
        sprint: [21]
      };
    }
  });

  // src/client/items.ts
  var items_exports = {};
  __export(items_exports, {
    addUseBlocker: () => addUseBlocker,
    canUse: () => canUse,
    closeIfNeeded: () => closeIfNeeded,
    itemData: () => itemData,
    runUse: () => runUse,
    setCloseIfNeeded: () => setCloseIfNeeded,
    useItemFromExport: () => useItemFromExport,
    useSlot: () => useSlot
  });
  function canUse(isAmmo = false) {
    const self = ped();
    return player.loaded && !player.using && !player.dead && !flags.busy() && !progressActive() && (!isAmmo || !!getCurrentWeapon()) && !IsPedRagdoll(self) && !IsPedFalling(self) && !IsPedShooting(self) && ![...blockers].some((blocked) => blocked());
  }
  function itemData(def, item) {
    return {
      name: def.name,
      label: typeof item.metadata?.label === "string" ? item.metadata.label : def.label,
      slot: item.slot,
      weight: item.weight,
      stack: def.stack,
      close: def.close,
      consume: def.consume,
      ...def.weapon ? { weapon: true, ammoname: def.weapon.ammoName } : {}
    };
  }
  async function useSlot(slot, noAnim = false) {
    const item = slotOf(slot);
    const def = item && registry.get(item.name);
    if (!item || !def) return;
    if (!canUse(def.ammo === true)) {
      if (getCurrentWeapon() && !def.weapon) notify(t("error_cannot_use", "No puedes usar eso ahora"));
      return;
    }
    if (def.component && !getCurrentWeapon()) return notify(t("error_cannot_use", "No puedes usar eso ahora"));
    if (def.weapon) return useWeapon(item, def, noAnim);
    if (def.ammo) {
      const weapon = getCurrentWeapon();
      if (!weapon || weapon.ammoName !== def.name || ammoIsFull()) return;
      await runUse(item, def, noAnim);
      return;
    }
    if (def.component) {
      await runUse(item, def, noAnim);
      return;
    }
    if (getCurrentWeapon() && !def.allowArmed) return notify(t("error_cannot_use", "No puedes usar eso ahora"));
    closeIfNeeded(def);
    if (def.clientExport) {
      const [resource, fn] = def.clientExport.split(".");
      if (resource && fn) {
        try {
          exports[resource][fn](itemData(def, item), { name: item.name, slot, metadata: item.metadata ?? {} });
        } catch (err) {
          console.log(`^1[nx_inventory] export ${def.clientExport}: ${err instanceof Error ? err.message : String(err)}^7`);
        }
      }
      return;
    }
    if (def.clientEvent) {
      emit(def.clientEvent, itemData(def, item), { name: item.name, slot, metadata: item.metadata ?? {} });
      return;
    }
    await runUse(item, def, noAnim);
  }
  async function useWeapon(item, def, noAnim) {
    if (!flags.weapons()) return;
    if (IsCinematicCamRendering()) SetCinematicModeActive(false);
    const current2 = getCurrentWeapon();
    if (current2) {
      if (current2.timer !== 0) return;
      const same = current2.slot === item.slot;
      disarm();
      if (same) return;
    }
    closeIfNeeded(def);
    await runUse(item, def, noAnim);
  }
  async function runUse(item, def, noAnim = false, after) {
    player.using = true;
    emit("nx_inventory:using", true);
    try {
      const ticket = await call("use", { slot: item.slot });
      if (!ticket.ok) {
        after?.(null);
        return false;
      }
      const success = await perform(ticket.data, item, def, noAnim);
      if (ticket.data.mode !== "done") await call("useDone", { token: ticket.data.token, success });
      if (success) {
        const metadata = ticket.data.metadata ?? {};
        emit("ox_inventory:usedItem", item.name, item.slot, Object.keys(metadata).length ? metadata : void 0);
        emit("nx_inventory:usedItem", item.name, item.slot, Object.keys(metadata).length ? metadata : void 0);
      }
      after?.(success ? itemData(def, item) : null);
      return success;
    } finally {
      setTimeout(() => {
        player.using = false;
        emit("nx_inventory:using", false);
      }, 500);
    }
  }
  async function perform(ticket, item, def, noAnim) {
    switch (ticket.mode) {
      case "done":
        return true;
      case "weapon":
        return equip(item, noAnim);
      case "ammo":
        await loadAmmo(ticket.count);
        return true;
      case "component": {
        const weapon = getCurrentWeapon();
        if (!weapon || !def.component) return false;
        const fits = def.component.hashes.find((h) => DoesWeaponTakeWeaponComponent(weapon.hash, GetHashKey(h)));
        if (!fits) {
          notify(t("error_cannot_use", "No puedes usar eso ahora"));
          return false;
        }
        if (HasPedGotWeaponComponent(ped(), weapon.hash, GetHashKey(fits))) return false;
        const added = await call("addComponent", { slot: item.slot });
        if (!added.ok) return false;
        GiveWeaponComponentToPed(ped(), weapon.hash, GetHashKey(fits));
        emit("ox_inventory:updateWeaponComponent", "added", GetHashKey(fits), item.name);
        return true;
      }
      case "client": {
        if (def.useTime && !noAnim) {
          const label = def.useLabel ?? `${t("ui_using", "Usando")} ${typeof item.metadata?.label === "string" ? item.metadata.label : def.label}`;
          const options = {
            duration: def.useTime,
            label,
            ...typeof def.anim === "object" ? { anim: def.anim } : {},
            ...def.prop && typeof def.prop !== "string" ? { prop: def.prop } : {},
            ...def.disable ? { disable: def.disable } : {},
            ...def.cancel ? { cancel: true } : {}
          };
          if (!await runProgress(options) || player.dead) return false;
        }
        if (def.notification) notify(def.notification, "info");
        if (def.status) applyStatus(def.status);
        if (config.itemNotify) sendNui({ action: "notify", data: { item: item.name, kind: "use", count: 1 } });
        return true;
      }
    }
  }
  function applyStatus(status) {
    for (const [name, raw] of Object.entries(status)) {
      const value = Math.abs(raw) > 100 ? raw * 1e-4 : raw;
      const current2 = Number(LocalPlayer.state[name] ?? 0);
      LocalPlayer.state.set(name, Math.max(0, Math.min(100, current2 + value)), true);
    }
  }
  async function useItemFromExport(data, cb) {
    const slot = Number(data?.slot);
    const item = Number.isInteger(slot) ? slotOf(slot) : void 0;
    const def = item && registry.get(item.name);
    if (!item || !def || !canUse(def.ammo === true)) {
      cb?.(false);
      return;
    }
    await runUse(item, def, false, (result) => {
      try {
        cb?.(result ?? false);
      } catch (err) {
        console.log(`^1[nx_inventory] callback de useItem (${item.name}): ${err instanceof Error ? err.message : String(err)}^7`);
      }
    });
  }
  var blockers, addUseBlocker, slotOf, closeIfNeeded, setCloseIfNeeded;
  var init_items = __esm({
    "src/client/items.ts"() {
      init_context();
      init_game();
      init_progress();
      init_nui();
      init_weapons();
      blockers = /* @__PURE__ */ new Set();
      addUseBlocker = (blocker) => blockers.add(blocker);
      slotOf = (slot) => state.player?.items.find((i) => i.slot === slot);
      closeIfNeeded = () => {
      };
      setCloseIfNeeded = (fn) => closeIfNeeded = fn;
    }
  });

  // src/client/weapons.ts
  function weaponForEvents() {
    if (!current) return void 0;
    return { name: current.name, label: current.label, slot: current.slot, hash: current.hash, metadata: current.metadata, ammo: current.ammoName, throwable: current.throwable, timer: current.timer };
  }
  function emitWeapon() {
    const data = weaponForEvents();
    emit("ox_inventory:currentWeapon", data);
    emit("nx_inventory:currentWeapon", data);
  }
  async function playHolsterAnim(group, out) {
    if (!config.weaponAnims || onBike()) return 0;
    let anim = ANIMS.get(group);
    if ((group === GROUP_PISTOL || group === GROUP_STUNGUN) && !isPolice()) anim = void 0;
    const dict = anim ? out ? anim[0] : anim[3] : "reaction@intimidation@1h";
    const clip = anim ? out ? anim[1] : anim[4] : out ? "intro" : "outro";
    const ms = anim ? out ? anim[2] : anim[5] : out ? 1200 : 1400;
    if (!await loadAnimDict(dict)) return 0;
    const self = ped();
    const [x, y, z] = coordsOf(self);
    TaskPlayAnimAdvanced(self, dict, clip, x, y, z, 0, 0, GetEntityHeading(self), 8, 3, out ? ms * 2 : ms, 50, out ? 0.1 : 0, 0, 0);
    RemoveAnimDict(dict);
    return ms;
  }
  async function equip(item, noAnim = false) {
    const def = registry.get(item.name);
    if (!def?.weapon) return false;
    const self = ped();
    const weaponHash = hash(def.name);
    const metadata = item.metadata ?? {};
    const group = GetWeapontypeGroup(weaponHash);
    if (!noAnim) {
      const sleep = await playHolsterAnim(group, true);
      if (sleep) await wait(sleep);
    }
    GiveWeaponToPed(self, weaponHash, 0, false, true);
    if (typeof metadata.tint === "number") SetPedWeaponTintIndex(self, weaponHash, metadata.tint);
    if (Array.isArray(metadata.components)) {
      for (const name of metadata.components) {
        const component = typeof name === "string" ? registry.get(name)?.component : void 0;
        for (const componentHash of component?.hashes ?? []) {
          if (DoesWeaponTakeWeaponComponent(weaponHash, hash(componentHash)) && !HasPedGotWeaponComponent(self, weaponHash, hash(componentHash))) {
            GiveWeaponComponentToPed(self, weaponHash, hash(componentHash));
          }
        }
      }
    }
    const fuel = FUEL_LIKE_WEAPONS.includes(def.name);
    const ammo = typeof metadata.ammo === "number" ? metadata.ammo : def.weapon.throwable ? 1 : 0;
    SetCurrentPedWeapon(self, weaponHash, true);
    SetPedCurrentWeaponVisible(self, true, false, false, false);
    SetWeaponsNoAutoswap(true);
    SetPedAmmo(self, weaponHash, fuel ? typeof metadata.durability === "number" ? metadata.durability : 100 : ammo);
    setTimeout(() => RefillAmmoInstantly(ped()), 0);
    if (fuel) SetPedInfiniteAmmo(self, true, weaponHash);
    if (GetSelectedPedWeapon(self) !== weaponHash) {
      RemoveWeaponFromPed(self, weaponHash);
      return false;
    }
    current = {
      slot: item.slot,
      name: def.name,
      label: typeof metadata.label === "string" ? metadata.label : def.label,
      hash: weaponHash,
      ...def.weapon.ammoName ? { ammoName: def.weapon.ammoName } : {},
      metadata: fuel ? { ...metadata, ammo: metadata.durability ?? 100 } : { ...metadata },
      throwable: def.weapon.throwable === true,
      melee: GetWeaponDamageType(weaponHash) === 2 ? 0 : null,
      timer: 0,
      group,
      fuel
    };
    startArmed();
    emitWeapon();
    if (config.weaponNotify) sendNui({ action: "notify", data: { item: def.name, kind: "equipped", count: 1 } });
    return true;
  }
  function disarm(noAnim = false) {
    const self = ped();
    const was = current;
    if (was) {
      current = null;
      stopArmed();
      void call("disarm", null);
      SetPedAmmo(self, was.hash, 0);
      if (!noAnim) {
        ClearPedSecondaryTask(self);
        void playHolsterAnim(was.group, false);
      }
      if (config.weaponNotify) sendNui({ action: "notify", data: { item: was.name, kind: "holstered", count: 1 } });
      emitWeapon();
    }
    RemoveAllPedWeapons(self, true);
  }
  function syncWithInventory() {
    if (!current) return;
    const item = state.player?.items.find((i) => i.slot === current.slot);
    if (!item || item.name !== current.name) {
      disarm(true);
      return;
    }
    const ammo = current.metadata.ammo;
    current.metadata = { ...item.metadata ?? {}, ...ammo !== void 0 && !current.fuel ? { ammo } : {} };
    luaArmed();
  }
  function luaArmed() {
    const w = current;
    emit(
      "nx_inventory:armed",
      w ? {
        hash: w.hash,
        ammo: typeof w.metadata.ammo === "number",
        throwable: w.throwable,
        melee: w.melee !== null,
        aimOnly: config.aimedFiring && w.melee === null && !w.fuel,
        broken: typeof w.metadata.durability === "number" && w.metadata.durability <= 0
      } : null
    );
  }
  function startArmed() {
    stopUnarmedWatch();
    luaArmed();
  }
  function stopArmed() {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
    emit("nx_inventory:armed", null);
    startUnarmedWatch();
  }
  function startUnarmedWatch() {
    if (unarmed || current) return;
    unarmed = true;
    emit("nx_inventory:unarmedWatch", true);
  }
  function stopUnarmedWatch() {
    if (!unarmed) return;
    unarmed = false;
    emit("nx_inventory:unarmedWatch", false);
  }
  function stopAll() {
    if (current) disarm(true);
    stopUnarmedWatch();
  }
  function scheduleFlush(weapon, delay) {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flush(weapon), delay);
  }
  function flush(weapon) {
    flushTimer = null;
    if (current !== weapon) return;
    if (flags.busy()) return scheduleFlush(weapon, 250);
    const ammo = weapon.metadata.ammo;
    if (typeof ammo === "number") {
      void call("updateWeapon", { slot: weapon.slot, ammo: Math.max(0, Math.floor(ammo)), shots: 0 });
      if (config.autoReload && weapon.ammoName && GetAmmoInPedWeapon(ped(), weapon.hash) === 0) void reload();
    } else if (weapon.melee) {
      void call("updateWeapon", { slot: weapon.slot, ammo: 0, shots: weapon.melee });
      weapon.melee = 0;
    }
  }
  async function throwWeapon(weapon) {
    throwing = true;
    const self = ped();
    while (current === weapon && (!IsPedWeaponReadyToShoot(self) || IsDisabledControlPressed(0, 24)) && GetSelectedPedWeapon(self) === weapon.hash) await wait(0);
    if (GetSelectedPedWeapon(self) === weapon.hash) await wait(700);
    while (IsPedPlantingBomb(self)) await wait(0);
    await call("throw", null);
    if (current === weapon) {
      current = null;
      stopArmed();
      RemoveWeaponFromPed(self, weapon.hash);
      emitWeapon();
    }
    throwing = false;
    if (current === weapon) luaArmed();
  }
  async function reload() {
    const weapon = current;
    if (!weapon?.ammoName || player.using || flags.busy()) return;
    const special = typeof weapon.metadata.specialAmmo === "string" ? weapon.metadata.specialAmmo : void 0;
    const slot = state.player?.items.find((i) => i.name === weapon.ammoName && (special ? i.metadata?.type === special : !i.metadata?.type))?.slot;
    if (slot === void 0) return;
    const { useSlot: useSlot2 } = await Promise.resolve().then(() => (init_items(), items_exports));
    await useSlot2(slot);
  }
  async function loadAmmo(count2) {
    const weapon = current;
    if (!weapon) return;
    const self = ped();
    const [, maxAmmo] = GetMaxAmmo(self, weapon.hash);
    let clip = GetMaxAmmoInClip(self, weapon.hash, true);
    if (maxAmmo < clip) clip = maxAmmo;
    const inWeapon = GetAmmoInPedWeapon(self, weapon.hash);
    const add = Math.min(count2, clip - inWeapon);
    if (add <= 0) return;
    const result = await call("reload", { ammo: inWeapon + add });
    if (!result.ok || current !== weapon) return;
    const accepted = result.data.ammo;
    AddAmmoToPed(self, weapon.hash, Math.max(0, accepted - inWeapon));
    weapon.metadata.ammo = accepted;
    if (GetVehiclePedIsIn(self, false)) TaskReloadWeapon(self, true);
    else {
      await wait(100);
      MakePedReload(self);
    }
  }
  function ammoIsFull() {
    const weapon = current;
    if (!weapon) return true;
    const self = ped();
    const [, maxAmmo] = GetMaxAmmo(self, weapon.hash);
    const clip = Math.min(GetMaxAmmoInClip(self, weapon.hash, true), maxAmmo);
    return GetAmmoInPedWeapon(self, weapon.hash) >= clip;
  }
  var current, throwing, flushTimer, UNARMED, GROUP_MELEE, GROUP_PISTOL, GROUP_STUNGUN, ANIMS, getCurrentWeapon, onBike, isPolice, unarmed;
  var init_weapons = __esm({
    "src/client/weapons.ts"() {
      init_types();
      init_context();
      init_game();
      init_nui();
      current = null;
      throwing = false;
      flushTimer = null;
      UNARMED = GetHashKey("WEAPON_UNARMED");
      GROUP_MELEE = GetHashKey("GROUP_MELEE");
      GROUP_PISTOL = GetHashKey("GROUP_PISTOL");
      GROUP_STUNGUN = GetHashKey("GROUP_STUNGUN");
      ANIMS = /* @__PURE__ */ new Map([
        [GROUP_MELEE, ["melee@holster", "unholster", 200, "melee@holster", "holster", 600]],
        [GROUP_PISTOL, ["reaction@intimidation@cop@unarmed", "intro", 400, "reaction@intimidation@cop@unarmed", "outro", 450]],
        [GROUP_STUNGUN, ["reaction@intimidation@cop@unarmed", "intro", 400, "reaction@intimidation@cop@unarmed", "outro", 450]]
      ]);
      getCurrentWeapon = () => current;
      onBike = () => {
        const vehicle2 = GetVehiclePedIsIn(ped(), false);
        if (!vehicle2) return false;
        const vehicleClass = GetVehicleClass(vehicle2);
        return vehicleClass === 8 || vehicleClass === 13;
      };
      isPolice = () => {
        const groups = LocalPlayer.state.nxGroups ?? {};
        return config.policeGroups.some((g) => groups[g] !== void 0);
      };
      unarmed = false;
      on("nx_inventory:weaponShot", () => {
        const weapon = current;
        const ammo = weapon?.metadata.ammo;
        if (!weapon || typeof ammo !== "number") return;
        const self = ped();
        const durability = typeof weapon.metadata.durability === "number" ? weapon.metadata.durability : 100;
        const drain = registry.get(weapon.name)?.weapon?.durability ?? 0;
        let left;
        if (weapon.fuel) {
          left = Math.max(0, ammo - drain);
          weapon.metadata.durability = left;
          weapon.metadata.ammo = left;
          if (left <= 0) SetPedInfiniteAmmo(self, false, weapon.hash);
        } else {
          left = GetAmmoInPedWeapon(self, weapon.hash);
          if (left < ammo) {
            weapon.metadata.ammo = left;
            weapon.metadata.durability = Math.max(0, durability - drain * (ammo - left));
          }
        }
        if (durability > 0 && typeof weapon.metadata.durability === "number" && weapon.metadata.durability <= 0) luaArmed();
        if (left <= 0) {
          if (GetVehiclePedIsIn(self, false)) TaskSwapWeapon(self, true);
          scheduleFlush(weapon, 200);
        } else {
          scheduleFlush(weapon, GetWeaponTimeBetweenShots(weapon.hash) * 1e3 + 100);
        }
      });
      on("nx_inventory:weaponMelee", () => {
        const weapon = current;
        if (!weapon || weapon.melee === null) return;
        weapon.melee++;
        scheduleFlush(weapon, 200);
      });
      on("nx_inventory:weaponThrow", () => {
        if (current?.throwable && !throwing) void throwWeapon(current);
      });
      on("nx_inventory:weaponMismatch", () => {
        if (!current) return;
        const self = ped();
        if (!flags.weapons() || player.dead) return disarm(true);
        SetCurrentPedWeapon(self, current.hash, true);
        if (typeof current.metadata.ammo === "number") SetAmmoInClip(self, current.hash, current.metadata.ammo);
        if (GetSelectedPedWeapon(self) !== current.hash) disarm(true);
      });
    }
  });

  // src/client/main.ts
  init_rpc();

  // src/shared/origin.ts
  /*! nx_inventory | Copyright (C) 2026 Nxzt1 | GPL-3.0-or-later | https://github.com/Nxzt1/nx_inventory | nxinv-605060a26b47f756 */
  var ORIGIN = Object.freeze({
    name: "nx_inventory",
    author: "Nxzt1",
    repository: "https://github.com/Nxzt1/nx_inventory",
    license: "GPL-3.0-or-later",
    id: "nxinv-605060a26b47f756"
  });

  // src/client/main.ts
  init_validate();

  // src/client/compat/frameworks.ts
  init_context();
  init_nui();

  // src/client/ui.ts
  init_context();
  init_game();
  init_nui();
  init_weapons();
  var anchor = null;
  var uiItems = /* @__PURE__ */ new Map();
  var itemButtons = /* @__PURE__ */ new Map();
  function uiDefs() {
    return [...uiItems.values()].map((def) => {
      const buttons = itemButtons.get(def.name);
      return buttons?.length ? { ...def, buttons: buttons.map((b) => b.label) } : def;
    });
  }
  function sendInit() {
    const ui = {};
    for (const [key2, value] of Object.entries(locale)) if (key2.startsWith("ui_") || key2.startsWith("error_")) ui[key2] = value;
    sendNui({
      action: "init",
      data: { locale: ui, items: uiDefs(), imagePath: config.imagePath, imageExt: config.imageExt, hotbarSlots: config.hotbarSlots }
    });
  }
  function canOpen() {
    const self = ped();
    return player.loaded && !flags.busy() && !player.dead && !IsPauseMenuActive() && !IsPedCuffed(self) && !IsPedFatallyInjured(self);
  }
  async function openInventory(req, options = {}) {
    if (!canOpen()) {
      notify(t("error_blocked", "Ahora no puedes"));
      return false;
    }
    const result = await call("open", req);
    if (!result.ok) return false;
    show(result.data.left, result.data.right, options.anchor ?? null, options.tab);
    return true;
  }
  function show(left, right, nextAnchor, tab) {
    if (player.right && player.right !== right?.id) state.drop(player.right);
    anchor?.onClose?.();
    state.set(left);
    if (right) state.set(right);
    player.open = true;
    player.right = right?.id ?? null;
    anchor = nextAnchor;
    SetNuiFocus(true, true);
    SetNuiFocusKeepInput(true);
    LocalPlayer.state.set("invOpen", true, false);
    sendNui({ action: "open", data: { left, ...right ? { right } : {}, ...tab ? { tab } : {} } });
    const { onClose: _, ...where } = anchor ?? { max: 0 };
    emit("nx_inventory:open", {
      enable: config.enableControls,
      move: !right || right.type === "drop",
      anchor: anchor ? where : null
    });
  }
  function closeInventory(fromServer = false) {
    if (!player.open) return;
    player.open = false;
    SetNuiFocus(false, false);
    SetNuiFocusKeepInput(false);
    LocalPlayer.state.set("invOpen", false, false);
    sendNui({ action: "close", data: null });
    emit("nx_inventory:open", null);
    anchor?.onClose?.();
    anchor = null;
    if (player.right) state.drop(player.right);
    player.right = null;
    if (!fromServer) void call("close", null);
  }
  on("nx_inventory:openLost", (reason) => {
    if (!player.open) return;
    closeInventory();
    if (reason === "far") notify(t("error_too_far", "Est\xE1s demasiado lejos"));
  });
  var counts = (view) => {
    const out = /* @__PURE__ */ new Map();
    for (const item of view?.items ?? []) out.set(item.name, (out.get(item.name) ?? 0) + item.count);
    return out;
  };
  function onSetup(payload) {
    stopAll();
    closeInventory(true);
    uiItems.clear();
    for (const def of payload.items) uiItems.set(def.name, def);
    state.clear();
    state.setPlayer(payload.inventory);
    player.loaded = true;
    sendInit();
    startUnarmedWatch();
    LocalPlayer.state.set("invBusy", false, true);
    LocalPlayer.state.set("invHotkeys", true, false);
    LocalPlayer.state.set("canUseWeapons", true, false);
    emitInventory(payload.inventory.items.map((i) => i.slot));
    for (const [name, count2] of counts(payload.inventory)) emit("ox_inventory:itemCount", name, count2);
  }
  function onLogout() {
    stopAll();
    closeInventory(true);
    player.loaded = false;
    state.clear();
  }
  function onPatches(patches) {
    const own = state.playerId;
    const before = counts(state.player);
    const applied = state.applyPatches(patches);
    if (applied.length === 0) return;
    sendNui({ action: "patch", data: applied });
    const mine = applied.filter((p) => p.inv === own);
    if (mine.length === 0) return;
    syncWithInventory();
    const after = counts(state.player);
    const names = /* @__PURE__ */ new Set([...before.keys(), ...after.keys()]);
    for (const name of names) {
      const diff = (after.get(name) ?? 0) - (before.get(name) ?? 0);
      if (diff === 0) continue;
      emit("ox_inventory:itemCount", name, after.get(name) ?? 0);
      if (config.itemNotify && !player.open) sendNui({ action: "notify", data: { item: name, kind: diff > 0 ? "add" : "remove", count: Math.abs(diff) } });
    }
    emitInventory(mine.flatMap((p) => p.slots.map((s) => s.slot)));
  }
  function onItems(defs) {
    for (const def of defs) uiItems.set(def.name, def);
    sendNui({ action: "items", data: uiDefs() });
  }
  function emitInventory(slots) {
    const changes = {};
    for (const slot of slots) {
      const item = state.player?.items.find((i) => i.slot === slot);
      const def = item && registry.get(item.name);
      changes[slot] = item ? { ...item, label: def?.label ?? item.name, metadata: item.metadata ?? {} } : false;
    }
    emit("ox_inventory:updateInventory", changes);
    emit("nx_inventory:updateInventory", changes);
  }

  // src/client/compat/frameworks.ts
  init_weapons();
  var exists = (resource) => GetResourceState(resource) !== "missing";
  function count(name) {
    return (state.player?.items ?? []).filter((i) => i.name === name).reduce((sum, i) => sum + i.count, 0);
  }
  function registerQb() {
    const hasItem = (items2, amount) => {
      const min = Number(amount) || 1;
      if (typeof items2 === "string") return count(items2) >= min;
      if (Array.isArray(items2)) return items2.length > 0 && items2.every((n) => typeof n === "string" && count(n) >= min);
      if (typeof items2 === "object" && items2 !== null) {
        const entries = Object.entries(items2);
        return entries.length > 0 && entries.every(([n, c]) => count(n) >= (Number(c) || min));
      }
      return false;
    };
    on("__cfx_export_qb-inventory_HasItem", (setCB) => setCB(hasItem));
    const itemBox = (item, kind, amount) => {
      const name = item?.name;
      if (typeof name !== "string") return;
      sendNui({ action: "notify", data: { item: name, kind: kind === "remove" ? "remove" : kind === "add" ? "add" : "use", count: Number(amount) || 1 } });
    };
    onNet("qb-inventory:client:ItemBox", itemBox);
    onNet("inventory:client:ItemBox", itemBox);
  }
  function registerEsx() {
    let cuffed = false;
    const setCuffed = (value) => {
      cuffed = value;
      LocalPlayer.state.set("invBusy", value, true);
      if (value) {
        closeInventory();
        disarm(true);
      }
    };
    onNet("esx_policejob:handcuff", () => setCuffed(!cuffed));
    onNet("esx_policejob:unrestrain", () => setCuffed(false));
  }
  function registerFrameworkClientCompat() {
    if (exists("qbx_core")) return;
    if (exists("es_extended")) registerEsx();
    else if (exists("qb-core")) registerQb();
  }

  // src/client/compat/ox.ts
  init_context();
  init_items();
  init_nui();
  init_weapons();

  // src/client/world.ts
  init_config();
  init_context();
  init_game();
  var RESOURCE2 = GetCurrentResourceName();
  var read2 = (path) => LoadResourceFile(RESOURCE2, path) ?? null;
  var drops = /* @__PURE__ */ new Map();
  function onDrops(push) {
    const add = [];
    const remove = [];
    for (const info of push.add ?? []) {
      if (drops.has(info.id)) continue;
      drops.set(info.id, info);
      add.push({ id: info.id, coords: info.coords, model: info.model ?? config.dropModel });
    }
    for (const id of push.remove ?? []) if (drops.delete(id)) remove.push(id);
    if (add.length > 0 || remove.length > 0) emit("nx_inventory:dropProps", add, remove);
  }
  function clearDrops() {
    drops.clear();
    emit("nx_inventory:dropProps", null, null);
  }
  function nearestDrop(max = 1.5) {
    const here = coordsOf(ped());
    let best = null;
    let bestDistance = max;
    for (const drop of drops.values()) {
      const d = dist(here, drop.coords);
      if (d <= bestDistance) {
        best = drop;
        bestDistance = d;
      }
    }
    return best;
  }
  var openDrop = (drop) => openInventory({ type: "drop", id: drop.id }, { anchor: { coords: drop.coords, max: 3 } });
  var zones = [];
  var blips = [];
  var models = [];
  var stashTarget = null;
  var setStashTarget = (id) => stashTarget = typeof id === "string" && id !== "" ? { id } : null;
  var target = () => GetResourceState("ox_target") === "started" ? exports.ox_target : null;
  function addZone(zone, label, icon, groups, onSelect) {
    const ox = target();
    if (!ox) return addFallbackPoint(zone.coords, label, onSelect);
    const height = zone.minZ !== void 0 && zone.maxZ !== void 0 ? zone.maxZ - zone.minZ : 1.5;
    const z = zone.minZ !== void 0 && zone.maxZ !== void 0 ? (zone.minZ + zone.maxZ) / 2 : zone.coords[2];
    zones.push(
      ox.addBoxZone({
        coords: { x: zone.coords[0], y: zone.coords[1], z },
        size: { x: zone.width ?? 1, y: zone.length ?? 1, z: height },
        rotation: zone.heading ?? 0,
        debug: false,
        options: [{ name: `nx_inventory:${label}`, label, icon, distance: zone.distance ?? 2, ...groups ? { groups } : {}, onSelect }]
      })
    );
  }
  function addBlip(coords, blip, label) {
    const handle = AddBlipForCoord(coords[0], coords[1], coords[2]);
    SetBlipSprite(handle, blip.sprite);
    SetBlipColour(handle, blip.colour);
    SetBlipScale(handle, blip.scale);
    SetBlipDisplay(handle, 4);
    SetBlipAsShortRange(handle, true);
    BeginTextCommandSetBlipName("STRING");
    AddTextComponentSubstringPlayerName(label);
    EndTextCommandSetBlipName(handle);
    blips.push(handle);
  }
  function setupPlaces() {
    clearPlaces();
    const shops = readJsonc(read2, "config/shops.jsonc");
    for (const [type, shop] of Object.entries(shops)) {
      const points = shop.targets?.length ? shop.targets.map((z) => z.coords) : shop.locations ?? [];
      points.forEach((coords, index) => {
        const zone = shop.targets?.[index] ?? { coords };
        addZone(
          zone,
          shop.label,
          "fas fa-cart-shopping",
          shop.groups,
          () => void openInventory({ type: "shop", id: `${type}:${index + 1}` }, { anchor: { coords, max: 4 } })
        );
        if (shop.blip) addBlip(coords, shop.blip, shop.label);
      });
      const ox = target();
      if (shop.models?.length && ox) {
        const list = shop.models.map(hash);
        const name = `nx_inventory:${type}`;
        ox.addModel(list, [
          {
            name,
            label: shop.label,
            icon: "fas fa-cart-shopping",
            distance: 2,
            onSelect: (data) => {
              if (!data?.entity) return;
              const coords = coordsOf(data.entity);
              void openInventory({ type: "shop", id: `${type}:`, coords }, { anchor: { coords, max: 3 } });
            }
          }
        ]);
        models.push({ models: list, name });
      }
    }
    const stashes = readJsonc(read2, "config/stashes.jsonc");
    for (const stash of stashes) {
      const zone = stash.target ?? (stash.coords ? { coords: stash.coords } : null);
      if (!zone) continue;
      const groups = stash.groups === "police" ? Object.fromEntries(config.policeGroups.map((g) => [g, 0])) : stash.groups;
      addZone(
        zone,
        zone.label ?? stash.label,
        "fas fa-box-archive",
        groups,
        () => void openInventory({ type: "stash", id: stash.name }, { anchor: { coords: stash.coords ?? zone.coords, max: config.stashDistance + 1 } })
      );
    }
  }
  function clearPlaces() {
    const ox = target();
    for (const id of zones) ox?.removeZone(id);
    for (const entry of models) ox?.removeModel(entry.models, entry.name);
    for (const blip of blips) RemoveBlip(blip);
    zones.length = 0;
    blips.length = 0;
    models.length = 0;
    fallback.length = 0;
  }
  var fallback = [];
  var fallbackTimer = null;
  var fallbackTick = null;
  var shown = null;
  function addFallbackPoint(coords, label, onSelect) {
    fallback.push({ coords, label, onSelect });
    if (fallbackTimer !== null) return;
    fallbackTimer = setInterval(() => {
      const here = coordsOf(ped());
      const near = fallback.find((p) => dist(here, p.coords) < 1.5) ?? null;
      if (near !== shown) {
        shown = near;
        const { textUiShow, textUiHide } = config.integrations;
        if (near && textUiShow) emit(textUiShow, { text: `[E] ${near.label}` });
        else if (!near && textUiHide) emit(textUiHide);
      }
      if (near && fallbackTick === null) {
        fallbackTick = setTick(() => {
          if (shown && !player.open && IsControlJustReleased(0, 38)) shown.onSelect();
        });
      } else if (!near && fallbackTick !== null) {
        clearTick(fallbackTick);
        fallbackTick = null;
      }
    }, 500);
  }
  var vehicles = readJsonc(read2, "config/vehicles.jsonc");
  var storage = new Map(Object.entries(vehicles.storage).map(([model, flag]) => [hash(model), flag]));
  var sizeModels = {
    trunk: new Set(Object.keys(vehicles.trunk.models).map(hash)),
    glovebox: new Set(Object.keys(vehicles.glovebox.models).map(hash))
  };
  var BACK_DOORS = [2, 3];
  var hasSize = (kind, model, vehicleClass) => sizeModels[kind].has(model) || vehicles[kind].byClass[String(vehicleClass)] !== void 0;
  function trunkDoor(entity) {
    const self = ped();
    if (GetVehiclePedIsIn(self, false) || !NetworkGetEntityIsNetworked(entity) || IsEntityDead(entity)) return null;
    const model = GetEntityModel(entity);
    const vehicleClass = GetVehicleClass(entity);
    const flag = storage.get(model);
    if (flag === 0 || flag === 1 || !hasSize("trunk", model, vehicleClass)) return null;
    let door = flag !== void 0 ? 4 : 5;
    if (!GetIsDoorValid(entity, door)) {
      if (vehicleClass !== 11 && (door !== 5 || GetEntityBoneIndexByName(entity, "boot") !== -1 || !GetIsDoorValid(entity, 2))) return null;
      if (vehicleClass !== 11) door = BACK_DOORS;
    }
    const [min, max] = GetModelDimensions(model);
    const factor = flag === void 0 ? [0.5, 0, 0.5] : [0.5, 1, 0.5];
    const offset = [0, 1, 2].map((i) => ((max[i] ?? 0) - (min[i] ?? 0)) * factor[i] + (min[i] ?? 0));
    const point = GetOffsetFromEntityInWorldCoords(entity, offset[0], offset[1], offset[2]);
    return dist(coordsOf(self), [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0]) < 1.5 ? door : null;
  }
  var doors = (door) => Array.isArray(door) ? door : [door];
  async function openTrunk(entity) {
    const door = trunkDoor(entity);
    if (door === null) return false;
    const [x, y, z] = coordsOf(entity);
    TaskTurnPedToFaceCoord(ped(), x, y, z, 0);
    const anchor2 = {
      entity,
      max: 3.5,
      onClose: () => {
        void playAnim("anim@heists@fleeca_bank@scope_out@return_case", "trevor_action", 1e3, 49, 2, 2);
        setTimeout(() => {
          for (const d of doors(door)) SetVehicleDoorShut(entity, d, false);
        }, 900);
      }
    };
    const opened = await openInventory({ type: "trunk", id: NetworkGetNetworkIdFromEntity(entity), vehicleClass: GetVehicleClass(entity) }, { anchor: anchor2 });
    if (!opened) return false;
    for (const d of doors(door)) SetVehicleDoorOpen(entity, d, false, false);
    await wait(200);
    void playAnim("anim@heists@prison_heiststation@cop_reactions", "cop_b_idle", -1, 49, 3, 3);
    return true;
  }
  function openGlovebox() {
    const self = ped();
    const vehicle2 = GetVehiclePedIsIn(self, false);
    if (!vehicle2 || !NetworkGetEntityIsNetworked(vehicle2) || IsEntityDead(vehicle2)) return false;
    const model = GetEntityModel(vehicle2);
    const vehicleClass = GetVehicleClass(vehicle2);
    const flag = storage.get(model);
    if (flag === 0 || flag === 2 || !hasSize("glovebox", model, vehicleClass)) return false;
    return openInventory({ type: "glovebox", id: NetworkGetNetworkIdFromEntity(vehicle2), vehicleClass }, { anchor: { inside: vehicle2, max: 0 } });
  }
  async function openSecondary() {
    if (stashTarget) {
      await openInventory({ type: "stash", id: stashTarget.id });
      return;
    }
    if (GetVehiclePedIsIn(ped(), false)) {
      await openGlovebox();
      return;
    }
    const hit = await raycast(2 | 16, 5);
    if (hit && hit.type === 2) await openTrunk(hit.entity);
  }

  // src/client/compat/ox.ts
  var matches = (item, metadata) => {
    if (metadata === void 0 || metadata === null) return true;
    const query = typeof metadata === "string" ? { type: metadata } : metadata;
    const own = item.metadata ?? {};
    return Object.entries(query).every(([key2, value]) => JSON.stringify(own[key2]) === JSON.stringify(value));
  };
  function oxSlot(item) {
    const def = registry.get(item.name);
    return {
      name: item.name,
      label: (typeof item.metadata?.label === "string" ? item.metadata.label : void 0) ?? def?.label ?? item.name,
      weight: item.weight,
      slot: item.slot,
      count: item.count,
      metadata: item.metadata ?? {},
      stack: def?.stack ?? true,
      close: def?.close ?? true,
      description: def?.description
    };
  }
  var items = () => state.player?.items ?? [];
  function search(kind, names, metadata) {
    const mode = kind === "slots" || kind === 1 ? "slots" : "count";
    const list = typeof names === "string" ? [names] : Array.isArray(names) ? names : [];
    const out = {};
    for (const raw of list) {
      const name = registry.get(raw)?.name ?? raw;
      const found = items().filter((i) => i.name === name && matches(i, metadata));
      out[raw] = mode === "count" ? found.reduce((sum, i) => sum + i.count, 0) : found.map(oxSlot);
    }
    return typeof names === "string" ? out[names] : out;
  }
  function oxItem(name) {
    const def = registry.get(name);
    if (!def) return void 0;
    const count2 = items().filter((i) => i.name === def.name).reduce((sum, i) => sum + i.count, 0);
    return { name: def.name, label: def.label, weight: def.weight, stack: def.stack, close: def.close, description: def.description, count: count2, ammoname: def.weapon?.ammoName };
  }
  async function oxOpen(type, data) {
    if (player.open) {
      closeInventory();
      return false;
    }
    if (!type) return openInventory({ type: "player" });
    const id = typeof data === "object" && data !== null ? data.id : data;
    switch (type) {
      case "player":
        return openInventory({ type: "player", ...typeof id === "number" ? { id } : {} });
      case "stash":
      case "shop":
        return typeof id === "string" || typeof id === "number" ? openInventory({ type, id: String(id) }) : false;
      case "drop":
        return typeof id === "string" ? openInventory({ type: "drop", id }) : false;
      case "glovebox":
        return await openGlovebox() === true;
      case "trunk": {
        const netId = Number(data?.netid);
        const entity = Number.isInteger(netId) ? NetworkGetEntityFromNetworkId(netId) : 0;
        return entity ? openTrunk(entity) : false;
      }
      default:
        return false;
    }
  }
  function registerOxClientCompat() {
    const exportsOx = {
      Search: (kind, names, metadata) => search(kind, names, metadata),
      GetItemCount: (name, metadata) => search("count", name, metadata),
      GetPlayerItems: () => items().map(oxSlot),
      Items: (name) => {
        if (typeof name === "string") return oxItem(name);
        const all = {};
        for (const def of registry.all()) all[def.name] = oxItem(def.name);
        return all;
      },
      getCurrentWeapon: () => weaponForEvents(),
      openInventory: (type, data) => oxOpen(type, data),
      closeInventory: () => closeInventory(),
      useItem: (data, cb) => useItemFromExport(data, cb),
      displayMetadata: (key2, label) => {
        const data = {};
        if (typeof key2 === "string" && typeof label === "string") data[key2] = label;
        else if (Array.isArray(key2)) for (const entry of key2) {
          const e = entry;
          if (typeof e?.metadata === "string" && typeof e.value === "string") data[e.metadata] = e.value;
        }
        else if (typeof key2 === "object" && key2 !== null) {
          for (const [k, v] of Object.entries(key2)) if (typeof v === "string") data[k] = v;
        }
        sendNui({ action: "displayMetadata", data });
      },
      setStashTarget: (id) => setStashTarget(id)
    };
    for (const [name, fn] of Object.entries(exportsOx)) on(`__cfx_export_ox_inventory_${name}`, (setCB) => setCB(fn));
    on("ox_inventory:disarm", (_playerId, noAnim) => disarm(noAnim === true));
    onNet("ox_inventory:disarm", (noAnim) => disarm(noAnim === true));
    onNet("ox_inventory:openInventory", (type, data) => void oxOpen(type, data));
    onNet("ox_inventory:closeInventory", () => closeInventory());
    onNet("ox_inventory:itemNotify", (data) => {
      if (!Array.isArray(data) || typeof data[0]?.name !== "string") return;
      const kind = data[1] === "ui_removed" ? "remove" : data[1] === "ui_added" ? "add" : "use";
      sendNui({ action: "notify", data: { item: data[0].name, kind, count: Number(data[2]) || 1 } });
    });
  }

  // src/client/main.ts
  init_context();

  // src/client/give.ts
  init_context();
  init_game();
  init_weapons();
  var HEAD = 31086;
  var LEFT_FOOT = 14201;
  var RIGHT_FOOT = 52301;
  var BODY_RADIUS = 0.55;
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var bone = (p, id) => {
    const c = GetPedBoneCoords(p, id, 0, 0, 0);
    return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0];
  };
  function rayToSegment(o, u, a, b) {
    const v = sub(b, a);
    const w = sub(o, a);
    const vv = dot(v, v);
    const uv = dot(u, v);
    const uw = dot(u, w);
    const vw = dot(v, w);
    const den = vv - uv * uv;
    let t2 = den > 1e-6 ? (vw - uv * uw) / den : 0;
    t2 = Math.min(1, Math.max(0, t2));
    const s = Math.max(0, dot(u, sub([a[0] + v[0] * t2, a[1] + v[1] * t2, a[2] + v[2] * t2], o)));
    const p = [o[0] + u[0] * s, o[1] + u[1] * s, o[2] + u[2] * s];
    const q = [a[0] + v[0] * t2, a[1] + v[1] * t2, a[2] + v[2] * t2];
    const d = sub(p, q);
    return { gap: Math.sqrt(dot(d, d)), along: s };
  }
  async function visible(target2) {
    const self = ped();
    const vehicle2 = GetVehiclePedIsIn(self, false);
    if (vehicle2 && GetVehiclePedIsIn(target2.ped, false) === vehicle2) return true;
    if (!IsEntityVisible(target2.ped)) return false;
    const [x, y, z] = coordsOf(self);
    const hit = await raycast(1 | 4 | 8 | 16, 0, [x, y, z + 0.5], [target2.coords[0], target2.coords[1], target2.coords[2] + 0.5]);
    return hit?.entity === target2.ped;
  }
  async function targetAt(x, y) {
    if (player.using) return null;
    const [origin, normal] = GetWorldCoordFromScreenCoord(x, y);
    const o = [origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0];
    const n = [normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0];
    const length = Math.sqrt(dot(n, n));
    if (length < 1e-6) return null;
    const u = [n[0] / length, n[1] / length, n[2] / length];
    const hits = [];
    for (const other of nearbyPlayers(coordsOf(ped()), config.giveDistance)) {
      const head = bone(other.ped, HEAD);
      const l = bone(other.ped, LEFT_FOOT);
      const r = bone(other.ped, RIGHT_FOOT);
      const feet = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, Math.min(l[2], r[2])];
      const { gap, along } = rayToSegment(o, u, [head[0], head[1], head[2] + 0.15], feet);
      if (gap <= BODY_RADIUS) hits.push({ other, along });
    }
    hits.sort((a, b) => a.along - b.along);
    for (const hit of hits) if (await visible(hit.other)) return hit.other.serverId;
    return null;
  }
  async function defaultTarget() {
    const self = ped();
    const vehicle2 = GetVehiclePedIsIn(self, false);
    if (vehicle2) {
      for (let seat = -1; seat < GetVehicleMaxNumberOfPassengers(vehicle2); seat++) {
        const other = GetPedInVehicleSeat(vehicle2, seat);
        if (other && other !== self && IsPedAPlayer(other) && IsEntityVisible(other)) return GetPlayerServerId(NetworkGetPlayerIndexFromPed(other));
      }
      return null;
    }
    for (const other of nearbyPlayers(coordsOf(self), config.giveDistance)) {
      if (await visible(other)) return other.serverId;
    }
    return null;
  }
  async function giveItem(slot, count2, target2) {
    const to = target2 ?? await defaultTarget();
    if (!to) return false;
    if (getCurrentWeapon()?.slot === slot) disarm();
    if (!GetVehiclePedIsIn(ped(), false)) void playAnim("mp_common", "givetake1_a", 2e3, 50, 1, 1);
    const result = await call("give", { slot, count: count2, target: to });
    return result.ok;
  }

  // src/client/main.ts
  init_items();
  init_game();
  init_nui();

  // src/client/personal/personal.ts
  init_personal();
  init_context();
  init_game();

  // src/client/personal/clothing.ts
  init_personal();
  init_game();
  var models2 = /* @__PURE__ */ new Map();
  var byId = /* @__PURE__ */ new Map();
  var animTimeout = 1500;
  var removed = /* @__PURE__ */ new Map();
  var busy = false;
  var playing = null;
  function check(entry, index) {
    const where = `clothing[${index + 1}]`;
    if (typeof entry.id !== "string" || !PERSONAL_ID.test(entry.id)) return `${where}: id no v\xE1lido`;
    if (byId.has(entry.id)) return `${where}: id "${entry.id}" repetido`;
    const isProp = typeof entry.prop === "number";
    const isComponent = typeof entry.component === "number";
    if (isProp === isComponent) return `${where} (${entry.id}): necesita \`component\` o \`prop\`, no ambos`;
    if (isComponent && (!Array.isArray(entry.off) || typeof entry.off[0] !== "number" || typeof entry.off[1] !== "number")) {
      return `${where} (${entry.id}): \`off\` debe ser [hombre, mujer]`;
    }
    const anim = entry.anim;
    if (anim !== void 0 && (!Array.isArray(anim) || typeof anim[0] !== "string" || typeof anim[1] !== "string" || typeof anim[2] !== "number" || anim[2] < 0)) {
      return `${where} (${entry.id}): \`anim\` debe ser [dict, clip, ms]`;
    }
    return null;
  }
  function setup(config3) {
    models2 = new Map(Object.entries(config3.models ?? {}).map(([model, column]) => [hash(model), column]));
    animTimeout = config3.animTimeout ?? 1500;
    byId = /* @__PURE__ */ new Map();
    removed = /* @__PURE__ */ new Map();
    (config3.clothing ?? []).forEach((entry, index) => {
      const problem = check(entry, index);
      if (problem) console.log(`^3[nx_inventory] personal ${problem}; se ignora^7`);
      else byId.set(entry.id, entry);
    });
  }
  var get = (id) => byId.get(id);
  var isBusy = () => busy;
  function plan(self, entry) {
    const id = entry.id;
    const saved = removed.get(id);
    if (typeof entry.prop === "number") {
      const slot2 = entry.prop;
      const current3 = GetPedPropIndex(self, slot2);
      if (current3 === -1) {
        if (!saved) return "none";
        return () => {
          SetPedPropIndex(self, slot2, saved[0], saved[1], true);
          removed.delete(id);
        };
      }
      removed.delete(id);
      return () => {
        removed.set(id, [current3, GetPedPropTextureIndex(self, slot2)]);
        ClearPedProp(self, slot2);
      };
    }
    const column = models2.get(GetEntityModel(self));
    if (!column || typeof entry.component !== "number" || !entry.off) return "unsupported";
    const slot = entry.component;
    const off = entry.off[column - 1];
    const current2 = GetPedDrawableVariation(self, slot);
    if (current2 === off) {
      if (!saved) return "none";
      return () => {
        SetPedComponentVariation(self, slot, saved[0], saved[1], saved[2] ?? 0);
        removed.delete(id);
      };
    }
    removed.delete(id);
    return () => {
      removed.set(id, [current2, GetPedTextureVariation(self, slot), GetPedPaletteVariation(self, slot)]);
      SetPedComponentVariation(self, slot, off, 0, 0);
    };
  }
  var stillValid = (self) => self === ped() && DoesEntityExist(self) && !IsPedDeadOrDying(self, true);
  async function perform2(self, anim, apply) {
    if (!anim || anim[2] === 0 || GetVehiclePedIsIn(self, false) || IsPedRagdoll(self)) {
      apply();
      return true;
    }
    const [dict, clip, duration] = anim;
    if (!await loadAnimDict(dict, animTimeout)) {
      apply();
      return true;
    }
    const half = Math.floor(duration / 2);
    TaskPlayAnim(self, dict, clip, 3, 3, duration, 51, 0, false, false, false);
    RemoveAnimDict(dict);
    playing = { ped: self, dict, clip };
    await wait(half);
    const valid = stillValid(self);
    if (valid) {
      apply();
      await wait(duration - half);
    }
    StopAnimTask(self, dict, clip, 1);
    playing = null;
    return valid;
  }
  async function toggle(id) {
    const entry = byId.get(id);
    if (!entry) return { ok: false, reason: "unknown" };
    if (busy) return { ok: false, reason: "busy" };
    const self = ped();
    if (!DoesEntityExist(self) || IsPedDeadOrDying(self, true)) return { ok: false, reason: "blocked" };
    const apply = plan(self, entry);
    if (typeof apply === "string") return { ok: false, reason: apply };
    busy = true;
    try {
      const done = await perform2(self, entry.anim, apply);
      return done ? { ok: true } : { ok: false, reason: "cancelled" };
    } catch (err) {
      cancel();
      console.log(`^1[nx_inventory] error al cambiar ${id}: ${err instanceof Error ? err.message : String(err)}^7`);
      return { ok: false, reason: "error" };
    } finally {
      busy = false;
    }
  }
  function state2(id) {
    const entry = byId.get(id);
    if (!entry) return void 0;
    const self = ped();
    if (typeof entry.prop === "number") {
      if (GetPedPropIndex(self, entry.prop) !== -1) return "worn";
      return removed.has(id) ? "removed" : "none";
    }
    const column = models2.get(GetEntityModel(self));
    if (!column || typeof entry.component !== "number" || !entry.off) return "unsupported";
    if (GetPedDrawableVariation(self, entry.component) !== entry.off[column - 1]) return "worn";
    return removed.has(id) ? "removed" : "none";
  }
  function states() {
    const out = {};
    for (const id of byId.keys()) out[id] = state2(id);
    return out;
  }
  var reset = () => removed.clear();
  function cancel() {
    if (playing && DoesEntityExist(playing.ped)) StopAnimTask(playing.ped, playing.dict, playing.clip, 1);
    playing = null;
  }

  // src/client/personal/personal.ts
  var hooks;
  var config2;
  var actions = /* @__PURE__ */ new Map();
  var definitions = null;
  var KINDS = ["clothing", "builtin", "command", "event"];
  function check2(entry, index) {
    const where = `actions[${index + 1}]`;
    if (typeof entry.id !== "string" || !PERSONAL_ID.test(entry.id)) return `${where}: id no v\xE1lido`;
    if (actions.has(entry.id)) return `${where}: id "${entry.id}" repetido`;
    const present = KINDS.filter((kind2) => entry[kind2] !== void 0);
    if (present.length !== 1) return `${where} (${entry.id}): necesita exactamente uno de ${KINDS.join(", ")}`;
    const kind = present[0];
    const value = entry[kind];
    if (typeof value !== "string" || value === "" || /[\r\n]/.test(value)) return `${where} (${entry.id}): \`${kind}\` debe ser un texto de una l\xEDnea`;
    if (kind === "clothing" && !get(value)) return `${where} (${entry.id}): la prenda "${value}" no existe`;
    if (kind === "builtin" && value !== "search" && value !== "vehicle") return `${where} (${entry.id}): no hay acci\xF3n integrada "${value}"`;
    return null;
  }
  function setup2(cfg, h) {
    config2 = cfg;
    hooks = h;
    actions.clear();
    definitions = null;
    setup(cfg);
    (cfg.actions ?? []).forEach((entry, index) => {
      const problem = check2(entry, index);
      if (problem) {
        console.log(`^3[nx_inventory] personal ${problem}; se ignora^7`);
        return;
      }
      const kind = KINDS.find((k) => entry[k] !== void 0);
      actions.set(entry.id, { ...entry, kind });
    });
    on(config.integrations.personalActionEvent, (text2) => void action(text2));
    for (const name of cfg.resetEvents ?? []) onNet(name, reset);
    if (typeof cfg.command === "string" && cfg.command !== "") {
      RegisterCommand(cfg.command, () => void openMenu(), false);
      if (typeof cfg.key === "string" && cfg.key !== "") RegisterKeyMapping(cfg.command, t("ui_personal_title", "Men\xFA personal"), "keyboard", cfg.key);
    }
  }
  var isBusy2 = isBusy;
  var reset2 = reset;
  var cancel2 = cancel;
  async function openMenu() {
    if (hooks.isOpen()) return;
    await hooks.openInventory("personal");
  }
  async function vehicle() {
    const here = coordsOf(ped());
    const nearest = nearbyPlayers(here, 3)[0];
    if (!nearest) return { ok: false, reason: "nobody_near" };
    if (GetVehiclePedIsIn(nearest.ped, false)) {
      const result2 = await call("vehicle", { target: nearest.serverId });
      if (result2.ok) notify(t("personal_vehicle_out", "Lo has sacado del veh\xEDculo"), "success");
      return { ok: result2.ok };
    }
    let best = 0;
    let bestDistance = 6;
    for (const entity of GetGamePool("CVehicle")) {
      const d = dist(here, coordsOf(entity));
      if (d < bestDistance) {
        best = entity;
        bestDistance = d;
      }
    }
    if (!best || !NetworkGetEntityIsNetworked(best)) {
      notify(t("personal_no_vehicle", "No hay ning\xFAn veh\xEDculo cerca"), "error");
      return { ok: false };
    }
    if (hooks.isOpen()) hooks.closeInventory();
    const result = await call("vehicle", { target: nearest.serverId, netId: NetworkGetNetworkIdFromEntity(best) });
    if (result.ok) notify(t("personal_vehicle_in", "Lo has metido en el veh\xEDculo"), "success");
    return { ok: result.ok };
  }
  async function search2() {
    const nearest = nearbyPlayers(coordsOf(ped()), config2.search?.distance ?? 2)[0];
    if (!nearest) return { ok: false, reason: "nobody_near" };
    if (hooks.isOpen()) hooks.closeInventory();
    const ok2 = await hooks.openNearby(nearest.serverId);
    return { ok: ok2 };
  }
  function explain2(reason, clothingId) {
    if (reason === "busy" || reason === "cancelled") return;
    if (reason === "none" && clothingId) {
      const entry = get(clothingId);
      notify(entry?.none ?? `${t("personal_not_wearing", "No llevas")} ${entry?.name ?? entry?.label ?? ""}`.trim());
      return;
    }
    const key2 = `personal_${reason === "unknown" ? "unavailable" : reason}`;
    notify(t(key2, t("personal_failed", "No se ha podido hacer")), reason === "unknown" ? "info" : "error");
  }
  async function action(text2) {
    if (typeof text2 !== "string" || text2.length > 48) return { ok: false, reason: "unknown" };
    const match = /^(clothes|action):([A-Za-z0-9_]{1,32})$/.exec(text2);
    if (!match) return { ok: false, reason: "unknown" };
    const [, kind, id] = match;
    try {
      return await run(kind, id);
    } catch (err) {
      console.log(`^1[nx_inventory] acci\xF3n personal ${text2}: ${err instanceof Error ? err.message : String(err)}^7`);
      notify(t("personal_failed", "No se ha podido hacer"));
      return { ok: false, reason: "error" };
    }
  }
  async function run(kind, id) {
    const entry = kind === "action" ? actions.get(id) : void 0;
    const clothingId = kind === "clothes" ? get(id) ? id : void 0 : entry?.kind === "clothing" ? entry.clothing : void 0;
    let response;
    if (!clothingId && !entry) response = { ok: false, reason: "unknown" };
    else if (!hooks.canAct()) response = { ok: false, reason: "blocked" };
    else if (entry?.authorized && LocalPlayer.state.nxAuthorized !== true) response = { ok: false, reason: "no_permission" };
    else if (clothingId) {
      const result = await toggle(clothingId);
      response = result.ok ? { ok: true } : { ok: false, reason: result.reason };
    } else if (entry.kind === "builtin") {
      response = entry.builtin === "vehicle" ? await vehicle() : await search2();
    } else {
      if (hooks.isOpen()) hooks.closeInventory();
      if (entry.kind === "command") ExecuteCommand(entry.command);
      else emit(entry.event);
      response = { ok: true };
    }
    if (!response.ok && response.reason) explain2(response.reason, clothingId);
    if (clothingId) {
      const current2 = state2(clothingId);
      if (current2) response.states = { [clothingId]: current2 };
    }
    return response;
  }
  function getDefinitions() {
    if (definitions) return definitions;
    const clothes = [];
    for (const entry of config2.clothing ?? []) {
      if (get(entry.id) === entry && !entry.hidden) clothes.push({ id: entry.id, label: entry.label, icon: entry.icon, ms: entry.anim?.[2] ?? 0 });
    }
    const list = [];
    for (const entry of actions.values()) {
      const clothing = entry.kind === "clothing" ? get(entry.clothing) : void 0;
      list.push({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        ms: clothing?.anim?.[2] ?? 0,
        ...entry.kind === "clothing" ? { clothing: entry.clothing } : {}
      });
    }
    definitions = { clothes, actions: list };
    return definitions;
  }
  var getStates = states;

  // src/client/main.ts
  init_weapons();
  var RESOURCE3 = GetCurrentResourceName();
  onNet(RPC_RESULT_EVENT, (raw) => rpc.receive(raw));
  onNet(PUSH_EVENTS.setup, (payload) => {
    if (!isRecord(payload) || !isRecord(payload.inventory) || !Array.isArray(payload.items)) return;
    reset2();
    onSetup(payload);
  });
  onNet(PUSH_EVENTS.logout, () => {
    rpc.cancelAll();
    reset2();
    clearDrops();
    onLogout();
  });
  onNet(PUSH_EVENTS.patch, (patches) => {
    if (Array.isArray(patches)) onPatches(patches);
  });
  onNet(PUSH_EVENTS.items, (defs) => {
    if (Array.isArray(defs)) onItems(defs.filter((d) => isRecord(d) && typeof d.name === "string"));
  });
  onNet(PUSH_EVENTS.drops, (push) => {
    if (isRecord(push)) onDrops(push);
  });
  onNet(PUSH_EVENTS.open, (data) => {
    if (!isRecord(data) || !isRecord(data.left) || !player.loaded) return;
    show(data.left, isRecord(data.right) ? data.right : void 0, null);
  });
  onNet(PUSH_EVENTS.close, () => {
    if (!player.open) return;
    closeInventory(true);
    notify(t("error_no_access", "No tienes acceso"));
  });
  onNet(PUSH_EVENTS.dropOpened, (drop) => {
    if (player.open && typeof drop === "string" && player.right !== drop) void openInventory({ type: "drop", id: drop });
  });
  var ok = { ok: true };
  onNui("ready", () => {
    sendInit();
    return true;
  });
  onNui("close", () => {
    closeInventory();
    return true;
  });
  onNui("move", async (data) => {
    const result = await call("move", data);
    return result.ok ? ok : { ok: false, error: result.error };
  });
  onNui("use", (data) => {
    void useSlot(data.slot);
    return ok;
  });
  onNui("give", async (data) => await giveItem(data.slot, data.count, data.target) ? ok : { ok: false, error: "not_found" });
  onNui("drop", async (data) => {
    if (getCurrentWeapon()?.slot === data.slot) disarm(true);
    const result = await call("drop", data);
    return result.ok ? ok : { ok: false, error: result.error };
  });
  onNui("buy", async (data) => {
    const result = await call("buy", data);
    return result.ok ? ok : { ok: false, error: result.error };
  });
  onNui("button", (data) => {
    const item = state.player?.items.find((i) => i.slot === data.slot);
    const button = item && itemButtons.get(item.name)?.[data.button];
    if (!button) return { ok: false, error: "not_found" };
    try {
      button.action(data.slot);
    } catch (err) {
      console.log(`^1[nx_inventory] bot\xF3n de ${item.name}: ${err instanceof Error ? err.message : String(err)}^7`);
    }
    return ok;
  });
  onNui("removeComponent", async (data) => {
    const weapon = getCurrentWeapon();
    const result = await call("removeComponent", data);
    if (!result.ok) return { ok: false, error: result.error };
    if (weapon?.slot === data.slot) disarm(true);
    return ok;
  });
  onNui("removeAmmo", async (data) => {
    if (getCurrentWeapon()?.slot === data.slot) disarm();
    const result = await call("removeAmmo", data);
    return result.ok ? ok : { ok: false, error: result.error };
  });
  onNui("targetAt", async (data) => ({ target: await targetAt(data.x, data.y) }));
  onNui("resync", async (data) => {
    const result = await call("resync", data);
    return result.ok ? result.data : null;
  });
  onNui("personalGet", (data) => {
    const states2 = getStates();
    return data.definitions ? { definitions: getDefinitions(), states: states2 } : { states: states2 };
  });
  onNui("personalRun", async (data) => player.open ? action(data.action) : { ok: false });
  RegisterCommand(
    "nxinv",
    () => {
      const self = PlayerPedId();
      console.log(
        `[nx_inventory] cliente: cargado=${player.loaded} abierto=${player.open} ocupado=${flags.busy()} muerto=${player.dead} foco NUI=${IsNuiFocused()} esposado=${IsPedCuffed(self)} men\xFA pausa=${IsPauseMenuActive()}`
      );
      emitNet("nx_inventory:diag");
    },
    false
  );
  onNet("nx_inventory:diag", (lines) => {
    if (Array.isArray(lines)) for (const line of lines) console.log(`[nx_inventory] servidor: ${String(line)}`);
  });
  function key(command, label, defaultKey, handler) {
    RegisterCommand(command, handler, false);
    RegisterKeyMapping(command, label, "keyboard", defaultKey);
  }
  var free = () => player.loaded && !IsNuiFocused() && !IsPauseMenuActive();
  key("nxinv_open", t("key_inventory", "Abrir el inventario"), config.keys.inventory, () => {
    if (player.open) return closeInventory();
    if (!free()) return;
    if (GetVehiclePedIsIn(PlayerPedId(), false)) {
      void (openGlovebox() || openInventory({ type: "player" }));
      return;
    }
    const drop = nearestDrop();
    void (drop ? openDrop(drop) : openInventory({ type: "player" }));
  });
  key("nxinv_secondary", t("key_secondary", "Abrir maletero, guantera o alijo"), config.keys.secondary, () => {
    if (player.open) return closeInventory();
    if (free()) void openSecondary();
  });
  key("nxinv_hotbar", t("key_hotbar", "Ver la barra r\xE1pida"), config.keys.hotbar, () => {
    if (free() && flags.hotkeys()) sendNui({ action: "hotbar", data: { visible: true } });
  });
  key("nxinv_reload", t("key_reload", "Recargar el arma"), config.keys.reload, () => {
    if (free()) void reload();
  });
  for (let slot = 1; slot <= config.hotbarSlots; slot++) {
    key(`nxinv_slot${slot}`, `${t("key_slot", "Usar la casilla r\xE1pida")} ${slot}`, String(slot), () => {
      if (!player.open && free() && flags.hotkeys()) void useSlot(slot);
    });
  }
  setCloseIfNeeded((def) => {
    if (player.open && def.close) closeInventory();
  });
  addUseBlocker(isBusy2);
  setup2(personalConfig, {
    canAct: () => player.loaded && !player.dead && !player.using && !flags.busy() && !IsPedCuffed(PlayerPedId()) && !IsPedFatallyInjured(PlayerPedId()),
    isOpen: () => player.open,
    closeInventory: () => closeInventory(),
    openInventory: (tab) => openInventory({ type: "player" }, { tab }),
    openNearby: (target2) => openInventory({ type: "player", id: target2 }, { anchor: { target: target2, max: config.searchDistance + 0.5 } })
  });
  onNet("nx_inventory:warpIntoVehicle", (netId) => {
    const vehicle2 = NetToVeh(netId);
    if (!vehicle2 || !DoesEntityExist(vehicle2)) return;
    const self = PlayerPedId();
    DetachEntity(self, true, false);
    const seat = [1, 2, 0].find((s) => IsVehicleSeatFree(vehicle2, s));
    if (seat !== void 0) TaskWarpPedIntoVehicle(self, vehicle2, seat);
  });
  onNet("nx_inventory:leaveVehicle", () => {
    const self = PlayerPedId();
    TaskLeaveVehicle(self, GetVehiclePedIsIn(self, false), 16);
  });
  AddStateBagChangeHandler("dead", `player:${GetPlayerServerId(PlayerId())}`, (_bag, _key, value) => {
    player.dead = value === true;
    if (player.dead) {
      if (getCurrentWeapon()) disarm(true);
      if (player.open) closeInventory();
    }
  });
  AddStateBagChangeHandler("canUseWeapons", `player:${GetPlayerServerId(PlayerId())}`, (_bag, _key, value) => {
    if (value === false && getCurrentWeapon()) disarm(true);
  });
  exports(
    "openInventory",
    (type, id) => openInventory(type ? { type, ...id !== void 0 ? { id } : {} } : { type: "player" })
  );
  exports("closeInventory", () => closeInventory());
  exports("about", () => ({ ...ORIGIN }));
  exports("isOpen", () => player.open);
  exports("useSlot", (slot) => useSlot(slot));
  exports("getCurrentWeapon", () => weaponForEvents());
  exports("getItems", () => state.player?.items ?? []);
  exports("setStashTarget", (id) => setStashTarget(id));
  exports("personalAction", (text2) => action(text2));
  exports("registerItemButton", (item, label, action2) => {
    if (typeof item !== "string" || typeof label !== "string" || typeof action2 !== "function") return false;
    const list = itemButtons.get(item) ?? [];
    list.push({ label, action: action2 });
    itemButtons.set(item, list);
    sendInit();
    return list.length - 1;
  });
  registerOxClientCompat();
  registerFrameworkClientCompat();
  setupPlaces();
  on("onResourceStop", (name) => {
    if (name !== RESOURCE3) return;
    rpc.cancelAll();
    cancel2();
    closeInventory(true);
    stopAll();
    clearDrops();
    clearPlaces();
  });
  on("onClientResourceStart", (name) => {
    if (name === "ox_target") setupPlaces();
  });
})();
