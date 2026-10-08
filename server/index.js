const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

const initialValues = {
  velocity: 185.4,
  pressure: 1012,
  temperature: 36.8
};

const state = {
  velocity: { unit: 'cm/s', history: [], base: 185.4 },
  pressure: { unit: 'mbar', history: [], base: 1012 },
  temperature: { unit: '°C', history: [], base: 36.8 }
};

let cycleCounter = 0;

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });
}

function seedHistory() {
  const now = new Date();
  for (let i = 0; i < 5; i += 1) {
    const time = new Date(now.getTime() - (4 - i) * 1000);
    state.velocity.history.push({ time: formatTime(time), value: initialValues.velocity - 5 + i * 1.3 });
    state.pressure.history.push({ time: formatTime(time), value: initialValues.pressure - 4 + i * 1.2 });
    state.temperature.history.push({ time: formatTime(time), value: initialValues.temperature - 0.6 + i * 0.15 });
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nextValue(key, currentValue) {
  const base = state[key].base;
  const driftPercent = (Math.random() - 0.5) * 0.2;
  let next = currentValue * (1 + driftPercent);

  if (cycleCounter % 5 === 0) {
    next = currentValue + (base - currentValue) * 0.22;
  }

  if (key === 'velocity') return clamp(next, 50, 260);
  if (key === 'pressure') return clamp(next, 850, 1150);
  return clamp(next, 20, 60);
}

function updateTelemetry() {
  cycleCounter += 1;

  ['velocity', 'pressure', 'temperature'].forEach((key) => {
    const current = state[key].history.length
      ? state[key].history[state[key].history.length - 1].value
      : state[key].base;

    const value = nextValue(key, current);
    const time = formatTime(new Date());

    state[key].history.push({ time, value });

    if (state[key].history.length > 100) {
      state[key].history.shift();
    }
  });
}

function buildPayload() {
  const timestamp = new Date().toISOString();

  return {
    timestamp,
    velocity: {
      value: state.velocity.history[state.velocity.history.length - 1].value,
      unit: state.velocity.unit,
      history: state.velocity.history
    },
    pressure: {
      value: state.pressure.history[state.pressure.history.length - 1].value,
      unit: state.pressure.unit,
      history: state.pressure.history
    },
    temperature: {
      value: state.temperature.history[state.temperature.history.length - 1].value,
      unit: state.temperature.unit,
      history: state.temperature.history
    }
  };
}

app.use(cors());
app.use(express.json());

app.get('/api/dashboard', (req, res) => {
  res.json(buildPayload());
});

seedHistory();
setInterval(updateTelemetry, 1000);

app.listen(PORT, () => {
  console.log(`Telemetry server running at http://localhost:${PORT}`);
});
