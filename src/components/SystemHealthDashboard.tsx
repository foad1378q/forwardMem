import React, { useEffect, useRef, useState, useId } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Pause,
  Play,
  Layers,
  Zap,
  Clock,
  Radio,
  Server,
  Info,
} from 'lucide-react';
import { SystemHealthMetrics, SystemHealthPoint } from '../types';
import { getSystemHealthMetrics } from '../lib/telegramApi';

interface SystemHealthDashboardProps {
  initialMetrics?: SystemHealthMetrics;
  onRefreshParent?: () => void;
}

type MetricKey = 'all' | 'successRate' | 'errorFrequency' | 'cpuPercent' | 'ramUsageMb';

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({
  initialMetrics,
}) => {
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(initialMetrics || null);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [activeMetric, setActiveMetric] = useState<MetricKey>('all');
  const [hoveredPoint, setHoveredPoint] = useState<SystemHealthPoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uniqueId = useId().replace(/:/g, '');

  // Track container width via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Poll real-time metrics every 3 seconds if isLive
  useEffect(() => {
    let isMounted = true;

    const fetchLatest = async () => {
      if (!isLive) return;
      const data = await getSystemHealthMetrics();
      if (data && isMounted) {
        setMetrics(data);
      }
    };

    if (!metrics) {
      fetchLatest();
    }

    const interval = setInterval(fetchLatest, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLive, metrics]);

  // Render or Update D3 Line Chart
  useEffect(() => {
    if (!svgRef.current || !metrics || !metrics.history || metrics.history.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous drawing

    const data = metrics.history;
    const width = containerWidth;
    const height = 280;
    const margin = { top: 25, right: 45, bottom: 35, left: 50 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradients Definition
    const defs = svg.append('defs');

    // Success Rate Gradient (Emerald)
    const gradSuccess = defs
      .append('linearGradient')
      .attr('id', `${uniqueId}-grad-success`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradSuccess.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.25);
    gradSuccess.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.0);

    // CPU Usage Gradient (Blue)
    const gradCpu = defs
      .append('linearGradient')
      .attr('id', `${uniqueId}-grad-cpu`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradCpu.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.22);
    gradCpu.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.0);

    // RAM Usage Gradient (Purple)
    const gradRam = defs
      .append('linearGradient')
      .attr('id', `${uniqueId}-grad-ram`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradRam.append('stop').attr('offset', '0%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.2);
    gradRam.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.0);

    // Error Frequency Gradient (Rose)
    const gradError = defs
      .append('linearGradient')
      .attr('id', `${uniqueId}-grad-error`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradError.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.35);
    gradError.append('stop').attr('offset', '100%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.0);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerWidth]);

    // Primary Y Scale (Percentage 0 - 100%)
    const yScalePercent = d3
      .scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    // Secondary Y Scale for Error Count / Spikes
    const maxErrors = Math.max(5, Number(d3.max(data, (d: SystemHealthPoint) => d.errorFrequency) || 5));
    const yScaleCount = d3
      .scaleLinear()
      .domain([0, maxErrors])
      .range([innerHeight, 0]);

    // Background Horizontal Gridlines
    const yGrid = d3
      .axisLeft(yScalePercent)
      .ticks(5)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '3,3');

    g.select('.grid .domain').remove();

    // Line and Area Generators
    const lineSuccess = d3
      .line<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScalePercent(d.successRate))
      .curve(d3.curveMonotoneX);

    const areaSuccess = d3
      .area<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScalePercent(d.successRate))
      .curve(d3.curveMonotoneX);

    const lineCpu = d3
      .line<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScalePercent(d.cpuPercent))
      .curve(d3.curveMonotoneX);

    const areaCpu = d3
      .area<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScalePercent(d.cpuPercent))
      .curve(d3.curveMonotoneX);

    const lineRam = d3
      .line<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScalePercent(d.ramPercent))
      .curve(d3.curveMonotoneX);

    const areaRam = d3
      .area<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScalePercent(d.ramPercent))
      .curve(d3.curveMonotoneX);

    const lineError = d3
      .line<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScaleCount(d.errorFrequency))
      .curve(d3.curveMonotoneX);

    const areaError = d3
      .area<SystemHealthPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScaleCount(d.errorFrequency))
      .curve(d3.curveMonotoneX);

    // Draw Areas and Lines based on active filter
    // 1. Success Rate
    if (activeMetric === 'all' || activeMetric === 'successRate') {
      g.append('path')
        .datum(data)
        .attr('fill', `url(#${uniqueId}-grad-success)`)
        .attr('d', areaSuccess);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('d', lineSuccess);
    }

    // 2. CPU Usage
    if (activeMetric === 'all' || activeMetric === 'cpuPercent') {
      g.append('path')
        .datum(data)
        .attr('fill', `url(#${uniqueId}-grad-cpu)`)
        .attr('d', areaCpu);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('d', lineCpu);
    }

    // 3. RAM Usage
    if (activeMetric === 'all' || activeMetric === 'ramUsageMb') {
      g.append('path')
        .datum(data)
        .attr('fill', `url(#${uniqueId}-grad-ram)`)
        .attr('d', areaRam);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#8b5cf6')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('d', lineRam);
    }

    // 4. Error Frequency
    if (activeMetric === 'all' || activeMetric === 'errorFrequency') {
      g.append('path')
        .datum(data)
        .attr('fill', `url(#${uniqueId}-grad-error)`)
        .attr('d', areaError);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,2')
        .attr('stroke-linecap', 'round')
        .attr('d', lineError);
    }

    // Left Y Axis (% for Success Rate, CPU, RAM)
    const yAxisLeft = d3
      .axisLeft(yScalePercent)
      .ticks(5)
      .tickFormat((d) => `${d}%`);

    g.append('g')
      .attr('class', 'y-axis-left text-3xs font-mono')
      .call(yAxisLeft)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('dx', '-4px');

    g.select('.y-axis-left .domain').attr('stroke', '#475569');
    g.selectAll('.y-axis-left .tick line').attr('stroke', '#475569');

    // Right Y Axis (Count for Errors)
    const yAxisRight = d3
      .axisRight(yScaleCount)
      .ticks(4)
      .tickFormat((d) => `${d}`);

    g.append('g')
      .attr('class', 'y-axis-right text-3xs font-mono')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(yAxisRight)
      .selectAll('text')
      .attr('fill', '#f43f5e')
      .attr('dx', '4px');

    g.select('.y-axis-right .domain').attr('stroke', '#475569');
    g.selectAll('.y-axis-right .tick line').attr('stroke', '#475569');

    // Bottom X Axis (Time labels)
    const tickIndices = [
      0,
      Math.floor(data.length / 4),
      Math.floor(data.length / 2),
      Math.floor((data.length * 3) / 4),
      data.length - 1,
    ].filter((idx, pos, arr) => arr.indexOf(idx) === pos && idx < data.length);

    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(tickIndices)
      .tickFormat((i) => data[i as number]?.timeLabel || '');

    g.append('g')
      .attr('class', 'x-axis text-3xs font-mono')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('dy', '10px');

    g.select('.x-axis .domain').attr('stroke', '#475569');
    g.selectAll('.x-axis .tick line').attr('stroke', '#475569');

    // Interactive Overlay for Tooltip & Crosshair
    const crosshair = g
      .append('line')
      .attr('class', 'crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0);

    // Focal Points
    const focusSuccess = g
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#10b981')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    const focusCpu = g
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    const focusRam = g
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#8b5cf6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    const focusError = g
      .append('circle')
      .attr('r', 4)
      .attr('fill', '#f43f5e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    // Mouse Tracking Rectangle
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const index = Math.round(xScale.invert(mx));
        const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
        const d = data[clampedIndex];

        if (!d) return;

        setHoveredPoint(d);

        const xPos = xScale(clampedIndex);
        crosshair.attr('x1', xPos).attr('x2', xPos).attr('opacity', 1);

        if (activeMetric === 'all' || activeMetric === 'successRate') {
          focusSuccess
            .attr('cx', xPos)
            .attr('cy', yScalePercent(d.successRate))
            .attr('opacity', 1);
        } else {
          focusSuccess.attr('opacity', 0);
        }

        if (activeMetric === 'all' || activeMetric === 'cpuPercent') {
          focusCpu
            .attr('cx', xPos)
            .attr('cy', yScalePercent(d.cpuPercent))
            .attr('opacity', 1);
        } else {
          focusCpu.attr('opacity', 0);
        }

        if (activeMetric === 'all' || activeMetric === 'ramUsageMb') {
          focusRam
            .attr('cx', xPos)
            .attr('cy', yScalePercent(d.ramPercent))
            .attr('opacity', 1);
        } else {
          focusRam.attr('opacity', 0);
        }

        if (activeMetric === 'all' || activeMetric === 'errorFrequency') {
          focusError
            .attr('cx', xPos)
            .attr('cy', yScaleCount(d.errorFrequency))
            .attr('opacity', 1);
        } else {
          focusError.attr('opacity', 0);
        }
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
        crosshair.attr('opacity', 0);
        focusSuccess.attr('opacity', 0);
        focusCpu.attr('opacity', 0);
        focusRam.attr('opacity', 0);
        focusError.attr('opacity', 0);
      });
  }, [metrics, containerWidth, activeMetric, uniqueId]);

  const current = metrics?.current;
  const summary = metrics?.summary;

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl text-slate-100 space-y-4"
      id="system-health-dashboard"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                داشبورد سلامت زیرساخت و تله‌متری (System Health)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-3xs font-black border border-blue-500/30 font-mono">
                D3.js Live Engine
              </span>
            </div>
            <p className="text-3xs text-slate-400 mt-0.5">
              پایش بلادرنگ نرخ موفقیت انتقال، فرکانس خطاها و مصرف CPU / RAM نود کلاینت تلگرام
            </p>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {/* Pause / Play toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              isLive
                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-amber-950/60 border-amber-700/80 text-amber-300 hover:bg-amber-900/80'
            }`}
            title={isLive ? 'توقف پایش زنده' : 'ادامه پایش زنده'}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Pause className="w-3.5 h-3.5" />
                <span>پایش زنده</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>متوقف شد</span>
              </>
            )}
          </button>

          {/* Node Health Status Badge */}
          <div
            className={`px-3 py-1.5 rounded-xl text-2xs font-bold border flex items-center gap-1.5 ${
              summary?.status === 'optimal'
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                : summary?.status === 'warning'
                ? 'bg-amber-950/70 border-amber-700/80 text-amber-300'
                : 'bg-rose-950/70 border-rose-700/80 text-rose-300'
            }`}
          >
            <Server className="w-3 h-3" />
            <span>
              نود: {summary?.status === 'optimal' ? 'پایدار و بهینه' : summary?.status === 'warning' ? 'هشدار بار نود' : 'بحرانی'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Core Real-Time KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Message Success Rate */}
        <div
          onClick={() => setActiveMetric(activeMetric === 'successRate' ? 'all' : 'successRate')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            activeMetric === 'successRate'
              ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-900/30'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-3xs text-slate-400 mb-1">
            <span className="font-bold">نرخ موفقیت ارسال</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {current ? `${current.successRate}%` : '--'}
            </span>
            <span className="text-3xs text-emerald-300/80">موفق</span>
          </div>
          <div className="text-3xs text-slate-400 mt-1 flex items-center justify-between">
            <span>میانگین دوره:</span>
            <span className="font-mono text-emerald-400 font-bold">{summary?.avgSuccessRate ?? 100}%</span>
          </div>
        </div>

        {/* 2. Error Frequency */}
        <div
          onClick={() => setActiveMetric(activeMetric === 'errorFrequency' ? 'all' : 'errorFrequency')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            activeMetric === 'errorFrequency'
              ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-900/30'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-3xs text-slate-400 mb-1">
            <span className="font-bold">فرکانس خطای انتقال</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-500">
              {current?.errorFrequency ?? 0}
            </span>
            <span className="text-3xs text-rose-400/80">خطا/بازه</span>
          </div>
          <div className="text-3xs text-slate-400 mt-1 flex items-center justify-between">
            <span>مجموع خطای پنجره:</span>
            <span className="font-mono text-rose-400 font-bold">{summary?.totalErrorsWindow ?? 0}</span>
          </div>
        </div>

        {/* 3. Node CPU Usage */}
        <div
          onClick={() => setActiveMetric(activeMetric === 'cpuPercent' ? 'all' : 'cpuPercent')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            activeMetric === 'cpuPercent'
              ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-900/30'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-3xs text-slate-400 mb-1">
            <span className="font-bold">پردازنده (CPU Usage)</span>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-400">
              {current ? `${current.cpuPercent}%` : '--'}
            </span>
            <span className="text-3xs text-blue-300/80">نود کلاینت</span>
          </div>
          <div className="text-3xs text-slate-400 mt-1 flex items-center justify-between">
            <span>میانگین پردازش:</span>
            <span className="font-mono text-blue-400 font-bold">{summary?.avgCpuPercent ?? 15}%</span>
          </div>
        </div>

        {/* 4. Node RAM Usage */}
        <div
          onClick={() => setActiveMetric(activeMetric === 'ramUsageMb' ? 'all' : 'ramUsageMb')}
          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
            activeMetric === 'ramUsageMb'
              ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-900/30'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-3xs text-slate-400 mb-1">
            <span className="font-bold">حافظه رم (RAM RSS)</span>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-purple-400">
              {current ? `${current.ramUsageMb} MB` : '--'}
            </span>
            <span className="text-3xs text-purple-300/80">({current?.ramPercent ?? 0}%)</span>
          </div>
          <div className="text-3xs text-slate-400 mt-1 flex items-center justify-between">
            <span>اوج مصرف حافظه:</span>
            <span className="font-mono text-purple-400 font-bold">{summary?.peakRamMb ?? 128} MB</span>
          </div>
        </div>
      </div>

      {/* Metric Filter Selector Pills & Hover Inspection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 text-2xs">
          <button
            onClick={() => setActiveMetric('all')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 ${
              activeMetric === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>نمایش همه نمودارها</span>
          </button>

          <button
            onClick={() => setActiveMetric('successRate')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeMetric === 'successRate'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>نرخ موفقیت</span>
          </button>

          <button
            onClick={() => setActiveMetric('errorFrequency')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeMetric === 'errorFrequency'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>فرکانس خطا</span>
          </button>

          <button
            onClick={() => setActiveMetric('cpuPercent')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeMetric === 'cpuPercent'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-blue-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>پردازنده CPU</span>
          </button>

          <button
            onClick={() => setActiveMetric('ramUsageMb')}
            className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeMetric === 'ramUsageMb'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-purple-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>حافظه RAM</span>
          </button>
        </div>

        {/* Hover Inspector readout */}
        {hoveredPoint ? (
          <div className="flex items-center gap-3 text-2xs font-mono bg-slate-900 px-3 py-1 rounded-xl border border-slate-700 text-slate-200">
            <span className="text-slate-400">{hoveredPoint.timeLabel}</span>
            <span className="text-emerald-400 font-bold">موفقیت: {hoveredPoint.successRate}%</span>
            <span className="text-rose-400 font-bold">خطا: {hoveredPoint.errorFrequency}</span>
            <span className="text-blue-400 font-bold">CPU: {hoveredPoint.cpuPercent}%</span>
            <span className="text-purple-400 font-bold">RAM: {hoveredPoint.ramUsageMb}MB</span>
          </div>
        ) : (
          <span className="text-3xs text-slate-400 hidden sm:inline">
            حرکت ماوس یا لمس روی نمودار جهت مشاهده جزئیات لحظه‌ای
          </span>
        )}
      </div>

      {/* SVG Container rendered with D3.js */}
      <div className="w-full relative overflow-x-auto bg-slate-950/40 rounded-2xl border border-slate-800/80 p-1">
        <svg
          ref={svgRef}
          className="w-full select-none overflow-visible block"
          style={{ minHeight: '280px' }}
        />
      </div>

      {/* Chart Legend and Telemetry Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-3xs text-slate-400 border-t border-slate-800 pt-3">
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-500 rounded-full" />
            <span className="text-slate-300">نرخ موفقیت انتقال (مقیاس ۰-۱۰۰٪)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-blue-500 rounded-full" />
            <span className="text-slate-300">بار پردازنده نود (CPU %)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-purple-500 rounded-full" />
            <span className="text-slate-300">مصرف حافظه رم (RAM %)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 border-b-2 border-dashed border-rose-500" />
            <span className="text-slate-300">فرکانس خطا (تعداد در محور راست)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span>نود تلگرام: {summary?.nodeVersion || process.version}</span>
          <span>•</span>
          <span>سیستم‌عامل: {summary?.platform || 'Linux x64'}</span>
          <span>•</span>
          <span>تاخیر تله‌متری: {current?.latencyMs || 42}ms</span>
        </div>
      </div>
    </div>
  );
};
