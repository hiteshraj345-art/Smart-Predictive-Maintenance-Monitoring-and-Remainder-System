const express = require('express');
    const cors = require('cors');
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    const nodemailer = require('nodemailer');

    dotenv.config();

    const app = express();
    const PORT = process.env.PORT || 5000;

    app.use(cors());
    app.use(express.json());

    const DB_FILE = path.join(__dirname, 'db.json');

    function loadDb() {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        return { machines: [], vitals: [] };
      }
    }

    function saveDb(db) {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    }

    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    let db = loadDb();

    function getTransporter() {
      if (!process.env.SMTP_HOST) {
        console.warn('SMTP not configured. Alerts will be logged to console only.');
        return null;
      }

      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    const transporter = getTransporter();

    async function sendAlertEmail(subject, text) {
      const to = process.env.ALERT_EMAIL_TO;
      if (!to) {
        console.warn('ALERT_EMAIL_TO not set. Alert:', subject, text);
        return;
      }

      if (!transporter) {
        console.log('EMAIL ALERT (simulated):', { subject, text, to });
        return;
      }

      try {
        await transporter.sendMail({
          from: process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER,
          to,
          subject,
          text
        });
        console.log('Alert email sent:', subject);
      } catch (err) {
        console.error('Error sending alert email:', err.message);
      }
    }

    app.get('/api/machines', (req, res) => {
      res.json(db.machines);
    });

    app.post('/api/machines', (req, res) => {
      const {
        name,
        code,
        location,
        nextMaintenanceDate,
        responsibleEmail,
        thresholds
      } = req.body;

      if (!name || !nextMaintenanceDate) {
        return res.status(400).json({ message: 'name and nextMaintenanceDate are required' });
      }

      const machine = {
        id: generateId(),
        name,
        code: code || '',
        location: location || '',
        nextMaintenanceDate,
        responsibleEmail: responsibleEmail || '',
        thresholds: thresholds || {
          temperature: 80,
          vibration: 10,
          pressure: 200
        },
        lastMaintenanceReminderSent: null,
        lastAbnormalAlertSent: null,
        createdAt: new Date().toISOString()
      };

      db.machines.push(machine);
      saveDb(db);

      res.status(201).json(machine);
    });

    app.put('/api/machines/:id', (req, res) => {
      const id = req.params.id;
      const idx = db.machines.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ message: 'Machine not found' });
      }
      db.machines[idx] = {
        ...db.machines[idx],
        ...req.body,
        id
      };
      saveDb(db);
      res.json(db.machines[idx]);
    });

    app.delete('/api/machines/:id', (req, res) => {
      const id = req.params.id;
      const idx = db.machines.findIndex(m => m.id === id);
      if (idx === -1) {
        return res.status(404).json({ message: 'Machine not found' });
      }
      db.machines.splice(idx, 1);
      db.vitals = db.vitals.filter(v => v.machineId !== id);
      saveDb(db);
      res.status(204).end();
    });

    app.get('/api/machines/:id/vitals', (req, res) => {
      const id = req.params.id;
      const limit = parseInt(req.query.limit || '50', 10);
      const vitals = db.vitals
        .filter(v => v.machineId === id)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-limit);
      res.json(vitals);
    });

    app.post('/api/machines/:id/vitals', async (req, res) => {
      const id = req.params.id;
      const machine = db.machines.find(m => m.id === id);
      if (!machine) {
        return res.status(404).json({ message: 'Machine not found' });
      }

      const { temperature, vibration, pressure, timestamp } = req.body;
      const vital = {
        id: generateId(),
        machineId: id,
        temperature: typeof temperature === 'number' ? temperature : null,
        vibration: typeof vibration === 'number' ? vibration : null,
        pressure: typeof pressure === 'number' ? pressure : null,
        timestamp: timestamp || new Date().toISOString()
      };

      db.vitals.push(vital);

      const thresholds = machine.thresholds || {
        temperature: 80,
        vibration: 10,
        pressure: 200
      };

      let abnormal = false;
      const reasons = [];

      if (vital.temperature !== null && vital.temperature > thresholds.temperature) {
        abnormal = true;
        reasons.push(`Temperature ${vital.temperature}°C > ${thresholds.temperature}°C`);
      }
      if (vital.vibration !== null && vital.vibration > thresholds.vibration) {
        abnormal = true;
        reasons.push(`Vibration ${vital.vibration}mm/s > ${thresholds.vibration}mm/s`);
      }
      if (vital.pressure !== null && vital.pressure > thresholds.pressure) {
        abnormal = true;
        reasons.push(`Pressure ${vital.pressure}bar > ${thresholds.pressure}bar`);
      }

      if (abnormal) {
        const now = new Date();
        const lastAlert = machine.lastAbnormalAlertSent ? new Date(machine.lastAbnormalAlertSent) : null;
        const minGapMinutes = parseInt(process.env.ABNORMAL_ALERT_MIN_GAP_MINUTES || '30', 10);

        if (!lastAlert || (now - lastAlert) / (1000 * 60) > minGapMinutes) {
          const subject = `⚠️ Abnormal condition detected on machine: ${machine.name}`;
          const text = `Machine: ${machine.name}
Code: ${machine.code || '-'}
Location: ${machine.location || '-'}
Time: ${vital.timestamp}

Reasons:
- ${reasons.join('\n- ')}

Latest reading:
- Temperature: ${vital.temperature ?? '-'} °C
- Vibration: ${vital.vibration ?? '-'} mm/s
- Pressure: ${vital.pressure ?? '-'} bar
`;

          await sendAlertEmail(subject, text);
          machine.lastAbnormalAlertSent = now.toISOString();
        }
      }

      saveDb(db);
      res.status(201).json({ vital, abnormal });
    });

    function checkUpcomingMaintenance() {
      const now = new Date();
      const lookaheadDays = parseInt(process.env.MAINTENANCE_LOOKAHEAD_DAYS || '7', 10);

      db.machines.forEach(machine => {
        if (!machine.nextMaintenanceDate) return;

        const due = new Date(machine.nextMaintenanceDate);
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);

        if (diffDays < 0) {
          diffDaysMessage = 'OVERDUE';
        }

        if (diffDays <= lookaheadDays) {
          const lastSent = machine.lastMaintenanceReminderSent ? new Date(machine.lastMaintenanceReminderSent) : null;
          if (!lastSent || (now - lastSent) / (1000 * 60 * 60 * 24) >= 1) {
            const subject = `🛠️ Maintenance due soon for machine: ${machine.name}`;
            const text = `Machine: ${machine.name}
Code: ${machine.code || '-'}
Location: ${machine.location || '-'}

Next maintenance date: ${machine.nextMaintenanceDate}
Days until due: ${diffDays.toFixed(1)}

Please schedule maintenance.`;

            sendAlertEmail(subject, text);
            machine.lastMaintenanceReminderSent = now.toISOString();
          }
        }
      });

      saveDb(db);
    }

    setInterval(checkUpcomingMaintenance, 60 * 1000);

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', machines: db.machines.length });
    });

    app.post('/api/machines/:id/vitals/simulate', (req, res) => {
      const id = req.params.id;
      const machine = db.machines.find(m => m.id === id);
      if (!machine) {
        return res.status(404).json({ message: 'Machine not found' });
      }

      const thresholds = machine.thresholds || {
        temperature: 80,
        vibration: 10,
        pressure: 200
      };

      function randAround(base, spread) {
        return base + (Math.random() * 2 - 1) * spread;
      }

      const temp = randAround(thresholds.temperature - 10, 8);
      const vib = randAround(thresholds.vibration - 3, 3);
      const pres = randAround(thresholds.pressure - 30, 20);

      const vital = {
        id: generateId(),
        machineId: id,
        temperature: Math.round(temp * 10) / 10,
        vibration: Math.round(vib * 10) / 10,
        pressure: Math.round(pres * 10) / 10,
        timestamp: new Date().toISOString()
      };

      db.vitals.push(vital);
      saveDb(db);

      res.status(201).json(vital);
    });

    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });