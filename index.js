/* ────────────────────────────────────────────────────────────
   index.js – Backend: Express + OpenAI + Notion
   Última actualización: regla 1/3/5 días y Bright 5 cores
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
      IA – clasificarConIA
      ─────────────────────────────────────────────────────────── */
   async function clasificarConIA(tareaTexto) {
     const prompt = `
   Eres una asistente personal experta en productividad y Notion.  
   Devuelve SIEMPRE un JSON con la siguiente forma:
   
   {
     "Título": "…",
     "Descripción": "…",
     "Deadline": "AAAA-MM-DD",           // Debe ser ISO válido
     "Área": "…",
     "Sub Área": "…",
     "Prioridad": "Alta | Media | Baja",
     "Nivel de Energía": "Alto | Medio | Bajo | Me da hueva"
   }
   
   Áreas y subáreas válidas (resumen):
   
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
   
   Bright (Full‑Time Job):
   - Product & UX Design
   - Visual Content & Collaterals Creation
   - Strategic Storytelling & Brand Communication
   - User Research & Insights
   - Events & Cross‑Team Support
   
   Others:
   - Others
   
   Si la tarea se relaciona con Bright, selecciona Bright + subcategoría adecuada.
   Si el texto tiene <5 caracteres alfabéticos (solo emojis / signos) clasifícalo como Área: Others / Sub Área: Others.
   
   Si el texto NO menciona fecha:
   - Prioridad Alta  → hoy +1 día
   - Prioridad Media → hoy +3 días
   - Prioridad Baja  → hoy +5 días
   Devuelve siempre una fecha ISO, nunca "YYYY-MM-DD" ni dejes el campo vacío.
   
   ⚠️ Devuelve ÚNICAMENTE el JSON sin texto extra.
   Tarea a clasificar: "${tareaTexto}"
   `;

     const response = await axios.post(
       'https://api.openai.com/v1/chat/completions',
       {
         model: 'gpt-4-turbo',
         messages: [
           { role: 'system', content: 'Eres una IA experta en organización personal y Notion.' },
           { role: 'user',   content: prompt }
         ],
         temperature: 0.3
       },
       { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
     );
   
     const raw = response.data.choices?.[0]?.message?.content;
     console.log('📦 IA bruta:\n', raw);
     return JSON.parse(raw);          // Si falla, se captura en el webhook
   }
   
   /* ── Utilidades fecha ─────────────────────────────────────── */
   function esFechaIso(str) {
     return /^\d{4}-\d{2}-\d{2}$/.test(str);
   }
   function calcularDeadlinePorPrioridad(prioridad = 'Baja') {
     const hoy  = new Date();
     const dias = prioridad === 'Alta' ? 1 : prioridad === 'Media' ? 3 : 5;
     hoy.setDate(hoy.getDate() + dias);
     return hoy.toISOString().split('T')[0];
   }
   
   /* ── Webhook ──────────────────────────────────────────────── */
   app.post('/webhook', async (req, res) => {
     const tareaTexto = req.body.Tarea[0].text.content;
     console.log('📥 Recibido:', tareaTexto);
   
     try {
       const c = await clasificarConIA(tareaTexto);
       console.log('🤖 Clasificación IA:', c);
   
       await axios.post(
         'https://api.notion.com/v1/pages',
         {
           parent: { database_id: DATABASE_ID },
           properties: {
             Tarea:          { title: [{ text: { content: c.Título } }] },
             Descripción:    { rich_text: [{ text: { content: c.Descripción } }] },
             Deadline: {
               date: { start: esFechaIso(c.Deadline) ? c.Deadline : calcularDeadlinePorPrioridad(c.Prioridad) }
             },
             Estado:        { status: { name: 'Not started' } },
             Prioridad:     { select: { name: c.Prioridad } },
             Área:          { select: { name: c['Área'] } },
             'Sub Área':    { select: { name: c['Sub Área'] } },
             'Nivel de Energía': { select: { name: c['Nivel de Energía'] } },
             'Fecha de creación': { date: { start: new Date().toISOString() } }
           }
         },
         { headers: {
             Authorization: `Bearer ${NOTION_TOKEN}`,
             'Notion-Version': '2022-06-28'
           }
         }
       );
   
       res.json({ success: true, message: '✅ Tarea enviada y clasificada con IA' });
   
     } catch (error) {
       console.error('❌ Error al procesar:', error.response?.data || error.message);
       res.status(500).json({ success: false, message: '⚠️ Error en la clasificación o envío a Notion' });
     }
   });
   
   /* ── Frontend estático ────────────────────────────────────── */
   app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
   
   /* ── Lanzar servidor ─────────────────────────────────────── */
   app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${PORT}`));
   