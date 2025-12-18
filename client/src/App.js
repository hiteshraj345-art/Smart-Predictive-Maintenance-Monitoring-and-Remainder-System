import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { FiCpu, FiAlertTriangle, FiCheckCircle, FiClock, FiPlus, FiTrash2, FiMail } from 'react-icons/fi';
import './App.css';

// Using local state instead of API for demo if API fails
const api = axios.create({
  baseURL: 'http://localhost:5000/api'
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    location: '',
    responsibleEmail: '',
    nextMaintenanceDate: '',
    thresholds: {
      temperature: 80,
      vibration: 10,
      pressure: 200
    }
  });

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await api.get('/machines');
      setMachines(response.data);
    } catch (error) {
      console.error('Failed to fetch machines:', error);
      // Fallback for GitHub Pages demo
      const localData = localStorage.getItem('demo_machines');
      if (localData) setMachines(JSON.parse(localData));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/machines', form);
      const newMachines = [...machines, response.data];
      setMachines(newMachines);
      localStorage.setItem('demo_machines', JSON.stringify(newMachines));
      setForm({
        name: '', code: '', location: '', responsibleEmail: '',
        nextMaintenanceDate: '', thresholds: { temperature: 80, vibration: 10, pressure: 200 }
      });
    } catch (error) {
      // Fallback for GitHub Pages demo
      const newMachine = { ...form, _id: Date.now().toString(), vitals: [] };
      const updated = [...machines, newMachine];
      setMachines(updated);
      localStorage.setItem('demo_machines', JSON.stringify(updated));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/machines/${id}`);
      const updated = machines.filter(m => m._id !== id);
      setMachines(updated);
      localStorage.setItem('demo_machines', JSON.stringify(updated));
    } catch (error) {
      const updated = machines.filter(m => m._id !== id);
      setMachines(updated);
      localStorage.setItem('demo_machines', JSON.stringify(updated));
    }
  };

  const selectedMachine = machines.find(m => m._id === selectedId);

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <FiCpu className="logo-icon" />
          <div>
            <h1>Smart Maintenance Monitor</h1>
            <p>Live machine vitals • Maintenance scheduling • Email alerts</p>
          </div>
        </div>
        <div className="status-badge">
          <span className="dot"></span>
          Backend connection: Local Storage Mode (Demo)
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          <section className="card list-section">
            <div className="card-header">
              <h2>Machines</h2>
              <span className="count">{machines.length}</span>
            </div>
            <div className="machine-list">
              {machines.length === 0 ? (
                <div className="empty-state">
                  <p>No machines yet.</p>
                  <p className="subtext">Add your first machine using the form below.</p>
                </div>
              ) : (
                machines.map(m => {
                  const status = statusForMachine(m);
                  return (
                    <div 
                      key={m._id} 
                      className={`machine-item ${selectedId === m._id ? 'active' : ''}`}
                      onClick={() => setSelectedId(m._id)}
                    >
                      <div className="item-info">
                        <h3>{m.name}</h3>
                        <code>{m.code}</code>
                      </div>
                      <div className="item-meta">
                        <span className="status-pill" style={{ backgroundColor: status.color }}>
                          {status.label}
                        </span>
                        <button 
                          className="btn-icon delete" 
                          onClick={(e) => { e.stopPropagation(); handleDelete(m._id); }}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="card form-section">
            <h3>Add Machine</h3>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="field">
                  <label>Name*</label>
                  <input 
                    required 
                    placeholder="Press #2 Hydraulic Press"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Code / Tag</label>
                  <input 
                    placeholder="M-HP-02"
                    value={form.code}
                    onChange={e => setForm({...form, code: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Location</label>
                  <input 
                    placeholder="Shop Floor A"
                    value={form.location}
                    onChange={e => setForm({...form, location: e.target.value})}
                  />
                </div>
                <div className="field">
                  <label>Responsible email</label>
                  <input 
                    type="email"
                    placeholder="maintenance@example.com"
                    value={form.responsibleEmail}
                    onChange={e => setForm({...form, responsibleEmail: e.target.value})}
                  />
                </div>
              </div>

              <div className="field">
                <label>Next maintenance date*</label>
                <input 
                  type="date"
                  required
                  value={form.nextMaintenanceDate}
                  onChange={e => setForm({...form, nextMaintenanceDate: e.target.value})}
                />
              </div>

              <div className="thresholds">
                <p><FiAlertTriangle /> Alert thresholds</p>
                <div className="t-grid">
                  <div className="field">
                    <label>Max temperature (°C)</label>
                    <input 
                      type="number"
                      value={form.thresholds.temperature}
                      onChange={e => setForm({...form, thresholds: {...form.thresholds, temperature: e.target.value}})}
                    />
                  </div>
                  <div className="field">
                    <label>Max vibration (mm/s)</label>
                    <input 
                      type="number"
                      value={form.thresholds.vibration}
                      onChange={e => setForm({...form, thresholds: {...form.thresholds, vibration: e.target.value}})}
                    />
                  </div>
                  <div className="field">
                    <label>Max pressure (bar)</label>
                    <input 
                      type="number"
                      value={form.thresholds.pressure}
                      onChange={e => setForm({...form, thresholds: {...form.thresholds, pressure: e.target.value}})}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={saving}>
                <FiPlus /> {saving ? 'Adding...' : 'Add machine'}
              </button>
            </form>
          </section>
        </aside>

        <section className="detail-view">
          {selectedMachine ? (
            <div className="detail-content">
              <div className="detail-header">
                <div>
                  <h2>{selectedMachine.name}</h2>
                  <p className="meta">{selectedMachine.code} • {selectedMachine.location}</p>
                </div>
                <div className="maintenance-info">
                  <FiClock /> Next: {new Date(selectedMachine.nextMaintenanceDate).toLocaleDateString()}
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <label>Temperature</label>
                  <div className="value">
                    {selectedMachine.vitals?.[selectedMachine.vitals.length-1]?.temperature || '--'}
                    <span>°C</span>
                  </div>
                </div>
                <div className="stat-card">
                  <label>Vibration</label>
                  <div className="value">
                    {selectedMachine.vitals?.[selectedMachine.vitals.length-1]?.vibration || '--'}
                    <span>mm/s</span>
                  </div>
                </div>
                <div className="stat-card">
                  <label>Pressure</label>
                  <div className="value">
                    {selectedMachine.vitals?.[selectedMachine.vitals.length-1]?.pressure || '--'}
                    <span>bar</span>
                  </div>
                </div>
              </div>

              <div className="chart-card card">
                <h3>Vital Trends (Last 10 readings)</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={selectedMachine.vitals?.slice(-10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="timestamp" 
                        stroke="#9ca3af" 
                        tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                      />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="temperature" stroke="#ef4444" name="Temp (°C)" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="vibration" stroke="#3b82f6" name="Vib (mm/s)" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="pressure" stroke="#10b981" name="Press (bar)" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="detail-placeholder">
              <FiCpu className="bg-icon" />
              <p>Select a machine to view its live vitals, trends and maintenance info.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
