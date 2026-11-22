(() => {
  const form = document.querySelector("[data-contact-form]");
  if (!form || !window.fetch || !window.AbortController) return;

  const status = form.querySelector("[data-contact-status]");
  const submit = form.querySelector('button[type="submit"]');
  const name = form.elements.namedItem("nombre");
  const email = form.elements.namedItem("email");
  const message = form.elements.namedItem("mensaje");
  const fields = [name, email, message];
  let sending = false;

  function announce(state, text) {
    status.dataset.state = state;
    status.textContent = text;
  }

  for (const field of [name, message]) {
    field.addEventListener("input", () => field.setCustomValidity(""));
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sending) return;

    const data = new FormData(form);
    const payload = Object.fromEntries(["nombre", "email", "mensaje", "sitio"].map(key => [
      key, String(data.get(key) ?? "").trim()
    ]));
    name.setCustomValidity(payload.nombre.length < 2 ? "Escribe tu nombre." : "");
    message.setCustomValidity(payload.mensaje.length < 10 ? "Escribe un mensaje de al menos 10 caracteres." : "");
    if (!form.reportValidity()) return;

    sending = true;
    submit.setAttribute("aria-disabled", "true");
    for (const field of fields) field.readOnly = true;
    announce("pending", "Enviando tu consulta…");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      if (response.status === 429) {
        announce("error", "Por ahora se alcanzó el límite de envíos. Puedes escribirme por correo directo o WhatsApp.");
        return;
      }
      if (response.status === 503) {
        announce("error", "El formulario no está disponible por ahora. Puedes escribirme por correo directo o WhatsApp.");
        return;
      }
      if (response.status === 400) {
        announce("error", "No pude aceptar los datos. Revisa tu dirección de correo y el mensaje.");
        return;
      }
      if (!response.ok) throw new Error("No se confirmó el envío.");
      const result = await response.json();
      if (result?.ok !== true) throw new Error("No se confirmó el envío.");

      form.reset();
      announce("success", result.confirmacion_enviada === true
        ? "Recibí tu mensaje. Revisa tu correo para ver la confirmación."
        : "Recibí tu mensaje. Si no llega la confirmación, no hace falta volver a enviarlo.");
    } catch {
      announce("error", "No pude confirmar el envío. El texto sigue en el formulario; puedes copiarlo y enviarlo por correo.");
    } finally {
      window.clearTimeout(timer);
      for (const field of fields) field.readOnly = false;
      submit.removeAttribute("aria-disabled");
      sending = false;
    }
  });

  form.parentElement.setAttribute("data-contact-ready", "");
  form.hidden = false;
})();
