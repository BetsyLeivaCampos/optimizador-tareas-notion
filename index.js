const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Configurar middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variables del entorno
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;


// Función que usa GPT para analizar el texto
async function clasificarConIA(tareaTexto) {
const prompt = `
  Eres una asistente personal experta en productividad y Notion. 
  Tu tarea es analizar el texto de una tarea y clasificarlo en un JSON estructurado.
  
  El JSON debe tener esta forma:

  {
    "Título": "...",                // Reformulación breve + input original
    "Descripción": "...",           // Explica brevemente qué implica la tarea
    "Deadline": "YYYY-MM-DD",       // Si no se menciona en el texto, infiere una fecha lógica: 1 día si es prioridad alta, 3 si es media, 5 si es baja
    "Área": "...",                  // Usa solo una de las áreas listadas abajo
    "Sub Área": "...",              // Usa solo una subárea correspondiente al área
    "Prioridad": "...",             // Alta, Media o Baja
    "Nivel de Energía": "..."       // Alto, Medio, Bajo, Me da hueva
  }  

  Devuelve también un campo "Título", que debe ser una reformulación breve y profesional del objetivo principal de la tarea, seguido de dos puntos y el texto original tal como fue escrito. Por ejemplo:

Input: "tengo ganas de ir a comer ramen con mis amigos y lo quiero planear"

Título: "Planear salida por ramen con amigos: tengo ganas de ir a comer ramen con mis amigos y lo quiero planear"
  
  Áreas y Sub Áreas válidas:
  
  Freelance & Entrepreneurship:
  - External client projects
  - Side hustles
  - TapTap / NeoTap
  - Investments
  
  Personal Growth:
  - Journaling & Daily Check-ins
  - Neuropsychology Readings
  - Therapy & Emotional Tracking
  - Food & Medication Tracking
  - Physical Health & Habits
  
  Professional Growth:
  - CV building
  - Skills Roadmap
  - Job searching
  - Career development
  
  Academic Life:
  - Erasmus Master’s Program
  - Academic Portfolio
  - Languages
  - Career roadmap
  
  Content & Creative Work:
  - Moodboards & Visual Notes
  - Instagram
  - YouTube
  - Style & Fashion
  - TikTok
  
  Life & Wellbeing:
  - Home / Cleaning / Setup
  - Bureaucratic Tasks
  - Couple / Family / Friends
  - Financial Organization
  - Travel Planning (Personal)
  - Celebrations & Social Life

  Others
  - Others
  
  Prioridad:
  - Alta
  - Media
  - Baja
  
  Nivel de Energía:
  - Alto
  - Medio
  - Bajo
  - Me da hueva
  
  No escribas ninguna explicación ni introducción. 
  Tu única respuesta debe ser el JSON válido.
  Tarea: "${tareaTexto}"
  `;
  

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'Eres una IA experta en productividad y organización personal.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const raw = response.data.choices[0].message.content;
  return JSON.parse(raw);
}

// Ruta que recibe tarea desde el front

function calcularDeadlinePorPrioridad(prioridad) {
  const diasExtra = prioridad === 'Alta' ? 2 : prioridad === 'Media' ? 3 : 5;
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasExtra);
  return fecha.toISOString().split('T')[0];
}

app.post('/webhook', async (req, res) => {
  const tareaTexto = req.body.Tarea[0].text.content;
  console.log('📥 Recibido:', tareaTexto);

  try {
    const clasificacion = await clasificarConIA(tareaTexto);
    console.log('🤖 Clasificación IA:', clasificacion);

    // Enviar a Notion
    await axios.post(
      'https://api.notion.com/v1/pages',
      {
        parent: { database_id: DATABASE_ID },
        properties: {
          Tarea: {
            title: [{ text: { content: clasificacion.Título } }]
          },
          Descripción: {
            rich_text: [{ text: { content: clasificacion.Descripción } }]
          },
          Deadline: {
            date: {
              start: clasificacion['Fecha de vencimiento'] 
                ? clasificacion['Fecha de vencimiento']
                : calcularDeadlinePorPrioridad(clasificacion.Prioridad)
            }
          },
          Estado: {
            status: { name: 'Not started' }
          },
          Prioridad: {
            select: { name: clasificacion.Prioridad }
          },
          Área: {
            select: { name: clasificacion['Área'] }
          },
          'Sub Área': {
            select: { name: clasificacion['Sub Área'] }
          },
          'Nivel de Energía': {
            select: { name: clasificacion['Nivel de Energía'] }
          },
          'Fecha de creación': {
            date: { start: new Date().toISOString() }
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

    res.json({ success: true, message: '✅ Tarea enviada y clasificada con IA' });
  } catch (error) {
    console.error('❌ Error al procesar:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: '⚠️ Error en la clasificación o envío a Notion' });
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

