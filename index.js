
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware para aceptar JSON en el body
app.use(express.json());
app.use(express.static('./'));

// Configuración de Notion
const NOTION_TOKEN = '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';
const DATABASE_ID = '1c967e9d749d8010b209deaa53ce7dea';

// Obtener fecha de hace 14 días
function getCutoffDate() {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString();
}

// Ruta para recibir tareas desde el formulario
app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📥 Recibido desde el formulario:', data);

  try {
    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_ID },
        properties: {
          Tarea: {
            title: [{ text: { content: data.Tarea[0].text.content } }]
          },
          Estado: {
            status: { name: data.Estado.name }
          },
          Prioridad: {
            select: { name: data.Prioridad.name }
          },
          Área: {
            select: { name: data.Área.name }
          },
          'Fecha de vencimiento': {
            date: data['Fecha de vencimiento']
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, message: '✅ Tarea guardada en Notion' });
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: '⚠️ Error al guardar en Notion' });
  }
});

// Ruta para limpiar tareas antiguas
app.get('/cleanup', async (req, res) => {
  const cutoffDate = getCutoffDate();

  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        filter: {
          and: [
            {
              property: 'Estado',
              status: { equals: 'Done' }
            },
            {
              property: 'Fecha de vencimiento',
              date: { before: cutoffDate }
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28'
        }
      }
    );

    const pages = response.data.results;
    
    for (const page of pages) {
      await axios.patch(
        `https://api.notion.com/v1/pages/${page.id}`,
        { archived: true },
        {
          headers: {
            Authorization: `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28'
          }
        }
      );
    }

    res.json({ success: true, message: `🗑️ ${pages.length} tareas archivadas` });
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: '⚠️ Error al archivar tareas' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
