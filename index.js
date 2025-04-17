/* ────────────────────────────────────────────────────────────
   index.js – Backend: Express + OpenAI + Notion
   Última actualización · corrige estructura y manejo de errores
   ──────────────────────────────────────────────────────────── */

   const express = require('express');
   const axios   = require('axios');
   const path    = require('path');
   require('dotenv').config();
   
   const app  = express();
   const PORT = 3000;
   
   /* ── Middlewares ─────────────────────────────────────────── */
   app.use(express.json());
   app.use(express.static(path.join(__dirname, 'public')));
   
   /* ── Variables de entorno ────────────────────────────────── */
   const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
   const NOTION_TOKEN   = process.env.NOTION_TOKEN;
   const DATABASE_ID    = process.env.DATABASE_ID;
   
   /* ───────────────────────────────────────────────────────────
      Función: clasificarConIA (GPT‑4 Turbo)
      Devuelve un objeto JSON con la estructura solicitada
      ─────────────────────────────────────────────────────────── */
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
   
     /* ── Llamada a OpenAI ─────────────────────────────────── */
     const response = await axios.post(
       'https://api.openai.com/v1/chat/completions',
       {
         model: 'gpt-4-turbo',
         messages: [
           { role: 'system', content: 'Eres una IA experta en organización personal, clasificación de tareas y Notion.' },
           { role: 'user',    content: prompt }
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
   
     const raw = response.data.choices?.[0]?.message?.content;
     console.log('📦 Contenido bruto de la IA:\n', raw);
   
     try {
       return JSON.parse(raw);
     } catch (err) {
       console.error('❌ JSON inválido recibido de la IA:', raw);
       throw new Error('La IA no devolvió un JSON válido.');
     }
   }
   
   /* ── Utilidad para deadline automático ──────────────────── */
   function calcularDeadlinePorPrioridad(prioridad) {
     const diasExtra = prioridad === 'Alta' ? 1 : prioridad === 'Media' ? 3 : 5;
     const fecha     = new Date();
     fecha.setDate(fecha.getDate() + diasExtra);
     return fecha.toISOString().split('T')[0];
   }
   
   /* ── Webhook del formulario front ───────────────────────── */
   app.post('/webhook', async (req, res) => {
     const tareaTexto = req.body.Tarea[0].text.content;
     console.log('📥 Recibido:', tareaTexto);
   
     try {
       const clasificacion = await clasificarConIA(tareaTexto);
       console.log('🤖 Clasificación IA:', clasificacion);
   
       /* ── Enviar a Notion ────────────────────────────────── */
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
                 start: clasificacion.Deadline || calcularDeadlinePorPrioridad(clasificacion.Prioridad)
               }
             },
             Estado:      { status: { name: 'Not started' } },
             Prioridad:   { select: { name: clasificacion.Prioridad } },
             Área:        { select: { name: clasificacion['Área'] } },
             'Sub Área':  { select: { name: clasificacion['Sub Área'] } },
             'Nivel de Energía': { select: { name: clasificacion['Nivel de Energía'] } },
             'Fecha de creación': { date: { start: new Date().toISOString() } }
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
   
   /* ── Home para servir index.html (frontend) ─────────────── */
   app.get('/', (req, res) => {
     res.sendFile(path.join(__dirname, 'index.html'));
   });
   
   /* ── Arranque del servidor ─────────────────────────────── */
   app.listen(PORT, '0.0.0.0', () => {
     console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
   });
   