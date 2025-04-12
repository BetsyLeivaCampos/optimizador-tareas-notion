
function enviarTarea() {
  const tareaTexto = document.getElementById('tarea').value.trim();
  if (!tareaTexto) {
    document.getElementById('status').textContent = '⚠️ Escribe una tarea antes de enviar.';
    return;
  }

  const payload = {
    Tarea: [
      {
        text: {
          content: tareaTexto
        }
      }
    ]
  };

  fetch('/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('status').textContent = data.message;
      if (data.success) {
        document.getElementById('tarea').value = '';
      }
    })
    .catch(() => {
      document.getElementById('status').textContent = '❌ Error de conexión al enviar.';
    });
}
