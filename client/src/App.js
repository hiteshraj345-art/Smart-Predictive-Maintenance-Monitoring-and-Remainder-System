import React, { useEffect, useState } from 'react';
    import axios from 'axios';
    import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
    import { FiCpu, FiAlertTriangle, FiCheckCircle, FiClock, FiPlus, FiTrash2, FiMail } from 'react-icons/fi';
    import './App.css';

    const api = axios.create({
      baseURL: '/api'
    });

    function statusForMachine(machine) {
      if (!machine.nextMaintenanceDate) return { label: 'Unknown', color: '#6b7280' };
      const due = new Date(machine.nextMaintenanceDate);
      const now = new Date();
      const diffDays = (due - now) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) return { label: 'Overdue', color: '#ef4444' };
      if (diffDays <= 3) return { label: 'Due soon', color: '#f97316' };
      if (diffDays <= 7) return { label: 'Planned', color: '#eab308' };
      return { label: 'OK', color: '#22c55e' };
    }

    function App() {
      const [machines, setMachines] = useState([]);
      const [selectedId, setSelectedId] = useState(null);
      const [loading, setLoading] = useState(false);
      const [saving, setSaving] = useState(false);
      const [form, setForm] = useState({
        name: '',
        code: '',
        location: '',
        nextMaintenanceDate: '',
        responsibleEmail: '',
        thresholds: {
          temperature: 80,
          vibration: 10,
          pressure: 200
        }
      });
      const [vitals, setVitals] = useState([]);
      const [vitalsLoading, setVitalsLoading] = useState(false);
      const [message, setMessage] = useState(null);

      const selectedMachine = machines.find(m => m.id === selectedId) || null;

      useEffect(() => {
        loadMachines();
      }, []);

      useEffect(() => {
        if (selectedId) {
          loadVitals(selectedId);
        } else {
          setVitals([]);
        }
      }, [selectedId]);

      async function loadMachines() {
        setLoading(true);
        try {
          const res = await api.get('/machines');
          setMachines(res.data);
          if (res.data.length && !selectedId) {
            setSelectedId(res.data[0].id);
          }
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: 'Failed to load machines' });
        } finally {
          setLoading(false);
        }
      }

      async function loadVitals(id) {
        setVitalsLoading(true);
        try {
          const res = await api.get(`/machines/${id}/vitals`, { params: { limit: 50 } });
          setVitals(res.data);
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: 'Failed to load live vitals' });
        } finally {
          setVitalsLoading(false);
        }
      }

      function handleFormChange(e) {
        const { name, value } = e.target;
        if (name.startsWith('thresholds.')) {
          const key = name.split('.')[1];
          setForm(prev => ({
            ...prev,
            thresholds: {
              ...prev.thresholds,
              [key]: Number(value)
            }
          }));
        } else {
          setForm(prev => ({
            ...prev,
            [name]: value
          }));
        }
      }

      async function handleCreateMachine(e) {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await api.post('/machines', form);
          setMachines(prev => [...prev, res.data]);
          setForm({
            name: '',
            code: '',
            location: '',
            nextMaintenanceDate: '',
            responsibleEmail: '',
            thresholds: {
              temperature: 80,
              vibration: 10,
              pressure: 200
            }
          });
          setMessage({ type: 'success', text: 'Machine added' });
          if (!selectedId) setSelectedId(res.data.id);
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add machine' });
        } finally {
          setSaving(false);
        }
      }

      async function handleDeleteMachine(id) {
        if (!window.confirm('Delete this machine and all its vitals?')) return;
        try {
          await api.delete(`/machines/${id}`);
          setMachines(prev => prev.filter(m => m.id !== id));
          if (selectedId === id) setSelectedId(null);
          setMessage({ type: 'success', text: 'Machine deleted' });
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: 'Failed to delete machine' });
        }
      }

      async function handleSimulateVital() {
        if (!selectedMachine) return;
        try {
          const res = await api.post(`/machines/${selectedMachine.id}/vitals/simulate`);
          setVitals(prev => [...prev, res.data].slice(-50));
          setMessage({ type: 'success', text: 'Simulated vital reading added' });
        } catch (err) {
          console.error(err);
          setMessage({ type: 'error', text: 'Failed to simulate vital reading' });
        }
      }

      function closeMessage() {
        setMessage(null);
      }

      return (
        <div className="app-shell">
          <header className="app-header">
            <div className="title-row">
              <div className="logo-circle">
                <FiCpu size={20} />
              </div>
              <div>
                <h1>Smart Maintenance Monitor</h1>
                <p>Live machine vitals • Maintenance scheduling • Email alerts</p>
              </div>
            </div>
            <div className="header-status">
              <span className="status-dot" />
              <span>Backend expected on http://localhost:5000</span>
            </div>
          </header>

          {message && (
            <div className={`toast toast-${message.type}`} onClick={closeMessage}>
              {message.type === 'error' ? <FiAlertTriangle /> : <FiCheckCircle />}
              <span>{message.text}</span>
            </div>
          )}

          <main className="app-main">
            <section className="left-panel">
              <div className="card">
                <div className="card-header">
                  <h2>Machines</h2>
                  <span className="badge">{machines.length}</span>
                </div>
                {loading ? (
                  <div className="empty">Loading machines…</div>
                ) : machines.length === 0 ? (
                  <div className="empty">
                    <p>No machines yet.</p>
                    <p>Add your first machine using the form below.</p>
                  </div>
                ) : (
                  <ul className="machine-list">
                    {machines.map(machine => {
                      const status = statusForMachine(machine);
                      const isSelected = machine.id === selectedId;
                      return (
                        <li
                          key={machine.id}
                          className={`machine-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedId(machine.id)}
                        >
                          <div className="machine-main">
                            <div className="machine-name-row">
                              <span className="machine-name">{machine.name}</span>
                              {machine.code && <span className="machine-code">#{machine.code}</span>}
                            </div>
                            <div className="machine-meta">
                              {machine.location && <span>{machine.location}</span>}
                              <span className="pill" style={{ backgroundColor: status.color + '33', color: status.color }}>
                                {status.label}
                              </span>
                            </div>
                          </div>
                          <button
                            className="icon-button delete"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteMachine(machine.id);
                            }}
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>Add Machine</h2>
                </div>
                <form className="form-grid" onSubmit={handleCreateMachine}>
                  <label>
                    Name*
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleFormChange}
                      placeholder="Press #2 Hydraulic Press"
                      required
                    />
                  </label>
                  <label>
                    Code / Tag
                    <input
                      name="code"
                      value={form.code}
                      onChange={handleFormChange}
                      placeholder="M-HP-02"
                    />
                  </label>
                  <label>
                    Location
                    <input
                      name="location"
                      value={form.location}
                      onChange={handleFormChange}
                      placeholder="Shop Floor A"
                    />
                  </label>
                  <label>
                    Responsible email
                    <input
                      type="email"
                      name="responsibleEmail"
                      value={form.responsibleEmail}
                      onChange={handleFormChange}
                      placeholder="maintenance@example.com"
                    />
                  </label>
                  <label>
                    Next maintenance date*
                    <input
                      type="date"
                      name="nextMaintenanceDate"
                      value={form.nextMaintenanceDate}
                      onChange={handleFormChange}
                      required
                    />
                  </label>

                  <div className="thresholds">
                    <div className="thresholds-header">
                      <FiAlertTriangle size={14} />
                      <span>Alert thresholds</span>
                    </div>
                    <div className="threshold-row">
                      <label>
                        Max temperature (°C)
                        <input
                          type="number"
                          name="thresholds.temperature"
                          value={form.thresholds.temperature}
                          onChange={handleFormChange}
                        />
                      </label>
                      <label>
                        Max vibration (mm/s)
                        <input
                          type="number"
                          name="thresholds.vibration"
                          value={form.thresholds.vibration}
                          onChange={handleFormChange}
                        />
                      </label>
                      <label>
                        Max pressure (bar)
                        <input
                          type="number"
                          name="thresholds.pressure"
                          value={form.thresholds.pressure}
                          onChange={handleFormChange}
                        />
                      </label>
                    </div>
                  </div>

                  <button className="primary-button" type="submit" disabled={saving}>
                    <FiPlus />
                    <span>{saving ? 'Saving…' : 'Add machine'}</span>
                  </button>
                </form>
              </div>
            </section>

            <section className="right-panel">
              {!selectedMachine ? (
                <div className="card empty-card">
                  <p>Select a machine to view its live vitals, trends and maintenance info.</p>
                </div>
              ) : (
                <>
                  <div className="card">
                    <div className="card-header">
                      <h2>Machine overview</h2>
                    </div>
                    <div className="machine-overview">
                      <div>
                        <h3>{selectedMachine.name}</h3>
                        <p className="muted">
                          {selectedMachine.code && <span>Tag: {selectedMachine.code} • </span>}
                          {selectedMachine.location || 'No location set'}
                        </p>
                        <p className="muted">
                          <FiClock /> Next maintenance:{' '}
                          {selectedMachine.nextMaintenanceDate
                            ? new Date(selectedMachine.nextMaintenanceDate).toLocaleDateString()
                            : 'Not set'}
                        </p>
                        {selectedMachine.responsibleEmail && (
                          <p className="muted">
                            <FiMail /> Alerts to: {selectedMachine.responsibleEmail} (plus global ALERT_EMAIL_TO)
                          </p>
                        )}
                      </div>
                      <div className="threshold-summary">
                        <p>Alert thresholds</p>
                        <ul>
                          <li>Temp ≤ {selectedMachine.thresholds?.temperature ?? 80} °C</li>
                          <li>Vibration ≤ {selectedMachine.thresholds?.vibration ?? 10} mm/s</li>
                          <li>Pressure ≤ {selectedMachine.thresholds?.pressure ?? 200} bar</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h2>Live vitals</h2>
                      <div className="card-actions">
                        <button className="ghost-button" onClick={() => loadVitals(selectedMachine.id)} disabled={vitalsLoading}>
                          Refresh
                        </button>
                        <button className="ghost-button" onClick={handleSimulateVital}>
                          Simulate reading
                        </button>
                      </div>
                    </div>
                    {vitalsLoading ? (
                      <div className="empty">Loading vitals…</div>
                    ) : vitals.length === 0 ? (
                      <div className="empty">
                        <p>No vitals yet.</p>
                        <p>
                          Send HTTP POST from your sensor to:
                          <code>/api/machines/{selectedMachine.id}/vitals</code>
                          or use the <strong>Simulate reading</strong> button.
                        </p>
                      </div>
                    ) : (
                      <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={vitals}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis
                              dataKey="timestamp"
                              tickFormatter={t => new Date(t).toLocaleTimeString()}
                              minTickGap={30}
                            />
                            <YAxis />
                            <Tooltip
                              labelFormatter={t => new Date(t).toLocaleString()}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="temperature" name="Temp (°C)" dot={false} />
                            <Line type="monotone" dataKey="vibration" name="Vibration (mm/s)" dot={false} />
                            <Line type="monotone" dataKey="pressure" name="Pressure (bar)" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h2>How to connect sensors</h2>
                    </div>
                    <div className="sensor-instructions">
                      <ol>
                        <li>
                          Ensure the backend is reachable from your sensor device at{' '}
                          <code>http://&lt;server-ip&gt;:5000</code>.
                        </li>
                        <li>
                          From your PLC / gateway / edge device, send an HTTP <code>POST</code> to:
                          <code>/api/machines/{selectedMachine.id}/vitals</code>
                          with JSON body:
                          <pre>{`{
  "temperature": 72.5,
  "vibration": 4.2,
  "pressure": 150.0,
  "timestamp": "2025-12-07T18:30:00.000Z"
}`}</pre>
                        </li>
                        <li>
                          Configure <code>.env</code> in the backend with SMTP credentials so that email alerts are
                          triggered when readings cross thresholds or maintenance is due soon.
                        </li>
                      </ol>
                    </div>
                  </div>
                </>
              )}
            </section>
          </main>
        </div>
      );
    }

    export default App;