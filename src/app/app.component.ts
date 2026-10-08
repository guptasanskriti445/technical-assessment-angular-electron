import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, interval, takeUntil } from 'rxjs';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export type MetricKey = 'velocity' | 'pressure' | 'temperature';

export interface MetricHistoryPoint {
  time: string;
  value: number;
}

export interface MetricPayload {
  value: number;
  unit: string;
  history: MetricHistoryPoint[];
}

export interface DashboardResponse {
  timestamp: string;
  velocity: MetricPayload;
  pressure: MetricPayload;
  temperature: MetricPayload;
}

export interface TelemetryMetric {
  name: string;
  key: MetricKey;
  unit: string;
  value: number;
  status: 'Normal' | 'Warning' | 'Critical';
  lastUpdated: string;
  history: MetricHistoryPoint[];
  chartData: ChartData<'line'>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dashboardSnapshot: DashboardResponse | null = null;
  private readonly metricConfig: Record<MetricKey, { label: string; options: string[]; color: string }> = {
    velocity: { label: 'Velocity', options: ['mm/s', 'cm/s', 'm/s', 'km/h', 'ft/s'], color: '#40c4ff' },
    pressure: { label: 'Pressure', options: ['Pa', 'kPa', 'mbar', 'bar', 'psi', 'atm'], color: '#ffd166' },
    temperature: { label: 'Temperature', options: ['°C', '°F', 'K'], color: '#7ae582' }
  };

  readonly metricKeys: MetricKey[] = ['velocity', 'pressure', 'temperature'];
  readonly selectedUnits: Record<MetricKey, string> = {
    velocity: 'cm/s',
    pressure: 'mbar',
    temperature: '°C'
  };

  readonly metrics: Record<MetricKey, TelemetryMetric> = {
    velocity: this.createMetric('Velocity', 'velocity', '#40c4ff'),
    pressure: this.createMetric('Pressure', 'pressure', '#ffd166'),
    temperature: this.createMetric('Temperature', 'temperature', '#7ae582')
  };

  connectionStatus = 'Connecting...';
  isLoading = true;
  errorMessage = '';
  lastSuccessfulUpdate = 'Waiting...';
  darkMode = false;

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed?.y ?? 0;
            return `${value.toFixed(2)} ${context.dataset.label ?? ''}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { autoSkip: true, maxTicksLimit: 8 },
        title: { display: true, text: 'Time' }
      },
      y: {
        title: { display: true, text: 'Value' }
      }
    }
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.applyTheme();
    this.loadDashboard();

    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadDashboard());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme();
  }

  private applyTheme(): void {
    document.body.classList.toggle('theme-dark', this.darkMode);
    document.body.classList.toggle('theme-light', !this.darkMode);
  }

  private static createMetric(name: string, key: MetricKey, color: string): TelemetryMetric {
    return {
      name,
      key,
      unit: '',
      value: 0,
      status: 'Normal',
      lastUpdated: '',
      history: [],
      chartData: {
        labels: [],
        datasets: [{
          label: '',
          data: [],
          borderColor: color,
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          fill: true,
          tension: 0.35
        }]
      }
    };
  }

  private loadDashboard(): void {
    this.http.get<DashboardResponse>('http://localhost:3000/api/dashboard').subscribe({
      next: (data) => {
        this.connectionStatus = 'Connected';
        this.isLoading = false;
        this.errorMessage = '';
        this.lastSuccessfulUpdate = data.timestamp;
        this.dashboardSnapshot = data;
        this.renderDashboard(data);
      },
      error: () => {
        this.connectionStatus = 'Offline';
        this.isLoading = false;
        this.errorMessage = 'Unable to fetch telemetry. Retrying...';
      }
    });
  }

  private renderDashboard(data: DashboardResponse): void {
    this.updateMetricState('velocity', data.velocity, this.selectedUnits.velocity);
    this.updateMetricState('pressure', data.pressure, this.selectedUnits.pressure);
    this.updateMetricState('temperature', data.temperature, this.selectedUnits.temperature);
  }

  private updateMetricState(key: MetricKey, payload: MetricPayload, targetUnit: string): void {
    const metric = this.metrics[key];
    const convertedHistory = payload.history.map((entry) => ({
      time: entry.time,
      value: this.convertValue(key, entry.value, payload.unit, targetUnit)
    }));

    const value = this.convertValue(key, payload.value, payload.unit, targetUnit);
    metric.unit = targetUnit;
    metric.value = value;
    metric.history = convertedHistory;
    metric.lastUpdated = new Date().toLocaleTimeString();
    metric.status = this.calculateStatus(key, value);
    metric.chartData = {
      labels: convertedHistory.map((point) => point.time),
      datasets: [{
        label: targetUnit,
        data: convertedHistory.map((point) => point.value),
        borderColor: this.metricConfig[key].color,
        backgroundColor: this.metricConfig[key].color + '22',
        fill: true,
        tension: 0.35
      }]
    };
  }

  onUnitChange(key: MetricKey, unit: string): void {
    this.selectedUnits[key] = unit;
    if (this.dashboardSnapshot) {
      this.renderDashboard(this.dashboardSnapshot);
    }
  }

  getGaugeProgress(key: MetricKey, value: number): string {
    const ranges: Record<MetricKey, { min: number; max: number }> = {
      velocity: { min: 0, max: 300 },
      pressure: { min: 800, max: 1200 },
      temperature: { min: 0, max: 100 }
    };

    const range = ranges[key];
    const progress = Math.min(Math.max((value - range.min) / (range.max - range.min), 0), 1);
    return `${(progress * 270).toFixed(0)}deg`;
  }

  calculateStatus(key: MetricKey, value: number): 'Normal' | 'Warning' | 'Critical' {
    if (key === 'velocity') {
      if (value < 60 || value > 260) return 'Critical';
      if (value < 80 || value > 220) return 'Warning';
      return 'Normal';
    }

    if (key === 'pressure') {
      if (value < 900 || value > 1100) return 'Critical';
      if (value < 950 || value > 1060) return 'Warning';
      return 'Normal';
    }

    if (value < 30 || value > 45) return 'Critical';
    if (value < 34 || value > 42) return 'Warning';
    return 'Normal';
  }

  convertValue(key: MetricKey, value: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return value;

    if (key === 'temperature') {
      const celsius = this.toCelsius(value, fromUnit);
      if (toUnit === '°C') return celsius;
      if (toUnit === '°F') return (celsius * 9) / 5 + 32;
      return celsius + 273.15;
    }

    const baseValue = this.toBaseValue(key, value, fromUnit);
    return this.fromBaseValue(key, baseValue, toUnit);
  }

  private toCelsius(value: number, unit: string): number {
    if (unit === '°C') return value;
    if (unit === '°F') return ((value - 32) * 5) / 9;
    if (unit === 'K') return value - 273.15;
    return value;
  }

  private toBaseValue(key: MetricKey, value: number, fromUnit: string): number {
    if (key === 'velocity') {
      const map: Record<string, number> = {
        'mm/s': value * 0.1,
        'cm/s': value,
        'm/s': value * 100,
        'km/h': value * 27.7778,
        'ft/s': value * 30.48
      };
      return map[fromUnit] ?? value;
    }

    if (key === 'pressure') {
      const map: Record<string, number> = {
        Pa: value,
        kPa: value * 1000,
        mbar: value * 100,
        bar: value * 100000,
        psi: value * 6894.76,
        atm: value * 101325
      };
      return map[fromUnit] ?? value;
    }

    return value;
  }

  private fromBaseValue(key: MetricKey, baseValue: number, toUnit: string): number {
    if (key === 'velocity') {
      const map: Record<string, number> = {
        'mm/s': baseValue / 0.1,
        'cm/s': baseValue,
        'm/s': baseValue / 100,
        'km/h': baseValue / 27.7778,
        'ft/s': baseValue / 30.48
      };
      return map[toUnit] ?? baseValue;
    }

    if (key === 'pressure') {
      const map: Record<string, number> = {
        Pa: baseValue,
        kPa: baseValue / 1000,
        mbar: baseValue / 100,
        bar: baseValue / 100000,
        psi: baseValue / 6894.76,
        atm: baseValue / 101325
      };
      return map[toUnit] ?? baseValue;
    }

    return baseValue;
  }

  exportCsv(): void {
    const times = this.metricKeys.map((key) => this.metrics[key].history.map((p) => p.time));
    const maxLength = Math.max(...times.map((arr) => arr.length), 0);

    const rows: string[][] = [['Timestamp', 'Velocity', 'Pressure', 'Temperature']];
    for (let i = 0; i < maxLength; i++) {
      const velocity = this.metrics.velocity.history[i]?.value ?? '';
      const pressure = this.metrics.pressure.history[i]?.value ?? '';
      const temperature = this.metrics.temperature.history[i]?.value ?? '';
      const timestamp = this.metrics.velocity.history[i]?.time ?? this.metrics.pressure.history[i]?.time ?? this.metrics.temperature.history[i]?.time ?? '';
      rows.push([timestamp, String(velocity), String(pressure), String(temperature)]);
    }

    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'controller-monitoring-data.csv');
  }

  exportExcel(): void {
    const data = [
      {
        timestamp: this.lastSuccessfulUpdate,
        velocity: this.metrics.velocity.value,
        pressure: this.metrics.pressure.value,
        temperature: this.metrics.temperature.value
      }
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Telemetry');
    XLSX.writeFile(workbook, 'controller-monitoring-data.xlsx');
  }
}
