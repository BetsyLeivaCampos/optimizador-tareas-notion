/* ────────────────────────────────────────────────────────────
   index.js  ·  Backend Express + OpenAI + Notion
   Versión: 2025‑04‑16 – Prompt con 5 cores Bright + regla 1/3/5 días
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
   const { OPENAI_API_KEY, NOTION_TOKEN, DATABASE_ID } = process.env;
   
   /* ───────────────────────────────────────────────────────────
      IA · clasificarConIA
      ─────────────────────────────────────────────────────────── */
   async function clasificarConIA(tareaTexto) {
     const prompt = `
   Eres una asistente personal experta en productividad y Notion.  
   Devuelve SIEMPRE un JSON válido con esta estructura (sin texto extra):
   
   {
     "Título": "...",
     "Descripción": "...",
     "Deadline": "AAAA-MM-DD",          // Debe ser ISO y futura
     "Área": "...",
     "Sub Área": "...",
     "Prioridad": "Alta | Media | Baja",
     "Nivel de Energía": "Alto | Medio | Bajo | Me da hueva"
   }
   
   Ejemplo de Título  
   Input: «tengo ganas de ir a comer ramen con mis amigos»  
   → Título: «Planear salida por ramen con amigos: tengo ganas de ir a comer ramen con mis amigos»
   
   ---
   
   ### Áreas y Sub Áreas válidas
   
   Freelance & Entrepreneurship  
   - External client projects  
   - Side hustles  
   - TapTap / NeoTap  
   - Investments  
   
   Personal Growth  
   - Journaling & Daily Check-ins  
   - Neuropsychology Readings  
   - Therapy & Emotional Tracking  
   - Food & Medication Tracking  
   - Physical Health & Habits  
   
   Professional Growth  
   - CV building · Skills Roadmap · Job searching · Career development  
   
   Academic Life  
   - Erasmus Master’s Program · Academic Portfolio · Languages · Career roadmap  
   
   Content & Creative Work  
   - Moodboards & Visual Notes · Instagram · YouTube · TikTok · Style & Fashion  
   
   Life & Wellbeing  
   - Home / Cleaning / Setup · Bureaucratic Tasks · Couple / Family / Friends  
   - Financial Organization · Travel Planning (Personal) · Celebrations & Social Life  
   
   Bright (Full‑Time Job)  
   - Product & UX Design  
   - Visual Content & Asset Creation  
   - Strategic Storytelling & Brand Communication  
   - User Research & Insights  
   - Events & Cross‑Team Support  
   
   Others  
   - Others  
   
   ---
   
   ### Reglas especiales
   
   1. Si la tarea pertenece a Bright, escoge Bright + subcategoría correcta.  
   2. Si el texto tiene < 5 letras (o solo emojis), pon Área = Others / Sub Área = Others.  
   3. Si el texto NO menciona fecha, aplica:  
      • Alta → hoy + 1 día · Media → hoy + 3 días · Baja → hoy + 5 días.  
   4. La fecha resultante debe ser igual o posterior a hoy (usa año y mes actuales).  
   5. Devuelve **solo** el JSON sin introducciones.
   
   ⚠️ Tarea a clasificar: "${tareaTexto}"
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
   
     try {
       return JSON.parse(raw);
     } catch {
       throw new Error('La IA no devolvió un JSON válido.');
     }
   }
   
   /* ── Utilidades de fecha ─────────────────────────────────── */
   function esFechaIsoFutura(str) {
     if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
     const hoy   = new Date(); hoy.setHours(0,0,0,0);
     const fecha = new Date(str);
     return fecha >= hoy;
   }
   function calcularDeadlinePorPrioridad(prio = 'Baja') {
     const hoy  = new Date();
     const dias = prio === 'Alta' ? 1 : prio === 'Media' ? 3 : 5;
     hoy.setDate(hoy.getDate() + dias);
     return hoy.toISOString().split('T')[0];
   }
   
   /* ── Webhook ─────────────────────────────────────────────── */
   app.post('/webhook', async (req, res) => {
     const tareaTexto = req.body.Tarea[0].text.content;
     console.log('📥 Recibido:', tareaTexto);
   
     try {
       const c = await clasificarConIA(tareaTexto);
       console.log('🤖 Clasificación IA:', c);
   
       /* Enviar a Notion */
       await axios.post(
         'https://api.notion.com/v1/pages',
         {
           parent: { database_id: DATABASE_ID },
           properties: {
             Tarea:          { title: [{ text: { content: c.Título } }] },
             Descripción:    { rich_text: [{ text: { content: c.Descripción } }] },
             Deadline: {
               date: { start: esFechaIsoFutura(c.Deadline) ? c.Deadline : calcularDeadlinePorPrioridad(c.Prioridad) }
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
   
     } catch (err) {
       console.error('❌ Error al procesar:', err.response?.data || err.message);
       res.status(500).json({ success: false, message: '⚠️ Error en la clasificación o envío a Notion' });
     }
   });
   
   /* ── Frontend estático ───────────────────────────────────── */
   app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));
   
   /* ── Lanzar servidor ─────────────────────────────────────── */
   app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor en puerto ${PORT}`));
   