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
Tu tarea es analizar el texto de una tarea escrita de forma libre y devolver un JSON estructurado y válido.

El JSON debe tener exactamente los siguientes campos:

{
  "Título": "Una reformulación breve y profesional del objetivo principal de la tarea, seguida de dos puntos y luego el texto original tal como fue escrito.",
  "Descripción": "Una explicación breve de lo que implica la tarea, redactada de manera clara.",
  "Deadline": "YYYY-MM-DD", 
  "Área": "Selecciona una de las áreas listadas abajo",
  "Sub Área": "Selecciona una subárea correspondiente al Área elegida",
  "Prioridad": "Alta, Media o Baja",
  "Nivel de Energía": "Alto, Medio, Bajo o Me da hueva"
}

Ejemplo de "Título":
- Input: "tengo ganas de ir a comer ramen con mis amigos y lo quiero planear"
- Título: "Planear salida por ramen con amigos: tengo ganas de ir a comer ramen con mis amigos y lo quiero planear"

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

Others:
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

⚠️ IMPORTANTE: Devuelve únicamente un JSON válido sin ningún texto adicional. No escribas "Aquí tienes tu JSON" ni introducciones. Solo el objeto JSON.  
Tarea a clasificar: "${tareaTexto}"
`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres una IA experta en organización personal, clasificación de tareas y Notion.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const raw = response.data.choices?.[0]?.message?.content;
    console.log("📦 Contenido bruto de la IA:\n", raw);

    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("❌ Error al parsear el JSON:", raw);
      throw new Error("La IA no devolvió un JSON válido. Input probablemente confuso.");
    }

  } catch (error) {
    console.error("❌ Error en la solicitud a OpenAI:", error.response?.data || error.message);
    throw error;
  }
}
 {
    console.error('❌ Error al procesar:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: '⚠️ Error en la clasificación o envío a Notion' });
  }


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

