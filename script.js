
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
    ],
    Estado: { name: 'Not started' },
    Prioridad: { name: 'Alta' },
    Área: { name: 'Marketing' },
    'Fecha de vencimiento': {
      start: new Date().toISOString().split('T')[0]
    }
  };

  fetch('/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (response.ok) {
        document.getElementById('status').textContent = '✅ Tarea enviada con éxito.';
      } else {
        document.getElementById('status').textContent = '❌ Error al enviar la tarea.';
      }
    })
    .catch(() => {
      document.getElementById('status').textContent = '❌ Error de conexión al enviar.';
    });
}
