const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const script = readFileSync(join(__dirname, "../assets/contact.js"), "utf8");
const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

function start(fetch) {
  let onSubmit, expire;
  const status = { dataset: {} };
  const submit = {
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; }
  };
  const input = value => ({
    value, validation: "",
    addEventListener() {},
    setCustomValidity(text) { this.validation = text; }
  });
  const fields = {
    nombre: input(" José de prueba "), email: input(" test@example.com "),
    mensaje: input(" Mensaje de prueba del portafolio. "), sitio: input("")
  };
  const form = {
    action: "https://api.josemercado.cl/contacto", hidden: true,
    parentElement: { setAttribute(key) { this[key] = true; } },
    querySelector(selector) { return selector === "[data-contact-status]" ? status : submit; },
    elements: { namedItem(key) { return fields[key]; } },
    addEventListener(event, fn) { assert.equal(event, "submit"); onSubmit = fn; },
    reportValidity() { return Object.values(fields).every(field => !field.validation); },
    reset() { for (const field of Object.values(fields)) field.value = ""; }
  };
  const request = [];
  const mockFetch = (url, options) => {
    request.push({ url, options });
    return fetch(url, options);
  };
  runInNewContext(script, {
    window: { fetch: mockFetch, AbortController, setTimeout(fn) { expire = fn; return 1; }, clearTimeout() {} },
    document: { querySelector() { return form; } },
    fetch: mockFetch, AbortController,
    FormData: class { get(key) { return fields[key].value; } }
  });
  return { form, fields, status, submit, request, expire: () => expire(), send: () => onSubmit({ preventDefault() {} }) };
}

test("envía solo los campos a la API del portafolio y muestra el acuse confirmado", async () => {
  const p = start(async () => reply(200, { ok: true, confirmacion_enviada: true }));
  assert.equal(p.form.hidden, false);
  await p.send();
  const [{url, options}] = p.request;
  assert.equal(url, "https://api.josemercado.cl/contacto");
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "omit");
  assert.deepEqual(JSON.parse(options.body), {
    nombre: "José de prueba", email: "test@example.com",
    mensaje: "Mensaje de prueba del portafolio.", sitio: ""
  });
  assert.equal(p.status.dataset.state, "success");
  assert.match(p.status.textContent, /Revisa tu correo/);
  assert.equal(p.fields.mensaje.value, "");
});

test("una consulta aceptada no pide reenviar si falta el acuse", async () => {
  const p = start(async () => reply(200, { ok: true, confirmacion_enviada: false }));
  await p.send();
  assert.equal(p.status.dataset.state, "success");
  assert.match(p.status.textContent, /no hace falta volver a enviarlo/);
});

test("mantiene los datos y distingue una indisponibilidad de un envío aceptado", async () => {
  for (const [status, expected] of [[400, /Revisa/], [429, /límite/], [503, /no está disponible/], [502, /No pude confirmar/]]) {
    const p = start(async () => reply(status, { ok: false, error: "Detalle interno" }));
    await p.send();
    assert.equal(p.status.dataset.state, "error");
    assert.match(p.status.textContent, expected);
    assert.ok(p.fields.mensaje.value);
    assert.equal(p.fields.mensaje.readOnly, false);
    assert.equal(p.submit["aria-disabled"], undefined);
  }
});

test("si el envío demora, evita duplicados y permite recuperar el mensaje", async () => {
  const p = start((url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  const processing = p.send();
  assert.equal(p.status.dataset.state, "pending");
  assert.equal(p.fields.mensaje.readOnly, true);
  await p.send();
  assert.equal(p.request.length, 1);
  p.expire();
  await processing;
  assert.match(p.status.textContent, /El texto sigue en el formulario/);
  assert.equal(p.fields.mensaje.readOnly, false);
});

test("recorta espacios y exige un mensaje real antes de hacer la solicitud", async () => {
  const p = start(async () => reply(200, { ok: true }));
  p.fields.nombre.value = "  ";
  p.fields.mensaje.value = "        Hola";
  await p.send();
  assert.match(p.fields.nombre.validation, /Escribe tu nombre/);
  assert.match(p.fields.mensaje.validation, /al menos 10 caracteres/);
  assert.equal(p.request.length, 0);
});
