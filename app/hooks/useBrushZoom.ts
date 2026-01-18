"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export type ZoomDomain = { x: [number, number]; y: [number, number] };
export type ZoomSource = "brush" | "range" | null;

export type UseBrushZoomOptions = {
  chartMargin: { top: number; right: number; left: number; bottom: number };
  dataBounds: { x: [number, number]; y: [number, number] } | null;
  activeDomain: { x: [number, number]; y: [number, number] } | null;
};

export type UseBrushZoomReturn = {
  // State
  isBrushing: boolean;
  zoomDomain: ZoomDomain | null;
  zoomSource: ZoomSource;
  
  // Refs for DOM manipulation
  brushOverlayRef: React.RefObject<HTMLDivElement | null>;
  chartContainerRef: React.RefObject<HTMLDivElement | null>;
  
  // Event handlers
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseMoveWithRaf: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseUp: () => void;
  
  // Actions
  resetZoom: () => void;
  setZoomDomain: React.Dispatch<React.SetStateAction<ZoomDomain | null>>;
  setZoomSource: React.Dispatch<React.SetStateAction<ZoomSource>>;
};

export function useBrushZoom(options: UseBrushZoomOptions): UseBrushZoomReturn {
  const { chartMargin, dataBounds, activeDomain } = options;

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const brushOverlayRef = useRef<HTMLDivElement | null>(null);
  const chartAreaRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Brush state
  const brushStartRef = useRef<{ x: number; y: number } | null>(null);
  const brushEndRef = useRef<{ x: number; y: number } | null>(null);
  const brushPixelStartRef = useRef<{ x: number; y: number } | null>(null);
  const brushPixelEndRef = useRef<{ x: number; y: number } | null>(null);
  const [isBrushing, setIsBrushing] = useState(false);
  
  // Zoom state
  const [zoomDomain, setZoomDomain] = useState<ZoomDomain | null>(null);
  const [zoomSource, setZoomSource] = useState<ZoomSource>(null);
  
  // rAF refs for performance
  const brushMoveFrameRef = useRef<number | null>(null);
  const pendingBrushUpdateRef = useRef<{
    pixel: { x: number; y: number };
    data: { x: number; y: number };
  } | null>(null);

  const applyBrushOverlay = useCallback(() => {
    if (!brushOverlayRef.current || !brushPixelStartRef.current || !brushPixelEndRef.current) return;
    const start = brushPixelStartRef.current;
    const end = brushPixelEndRef.current;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const el = brushOverlayRef.current;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  }, []);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!chartContainerRef.current || !activeDomain) return;
    
    const containerRect = chartContainerRef.current.getBoundingClientRect();
    
    // Try to find CartesianGrid for accurate chart area
    const gridElement = chartContainerRef.current.querySelector(".recharts-cartesian-grid");
    let area: { x: number; y: number; width: number; height: number };
    
    if (gridElement) {
      const gridRect = gridElement.getBoundingClientRect();
      area = {
        x: gridRect.left - containerRect.left,
        y: gridRect.top - containerRect.top,
        width: gridRect.width,
        height: gridRect.height
      };
    } else {
      // Fallback to margin calculation
      area = {
        x: chartMargin.left,
        y: chartMargin.top,
        width: containerRect.width - chartMargin.left - chartMargin.right,
        height: containerRect.height - chartMargin.top - chartMargin.bottom
      };
    }
    chartAreaRef.current = area;
    
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Check if within chart area
    if (mouseX < area.x || mouseX > area.x + area.width || mouseY < area.y || mouseY > area.y + area.height) {
      return;
    }
    
    // Store pixel coordinates
    brushPixelStartRef.current = { x: mouseX, y: mouseY };
    brushPixelEndRef.current = { x: mouseX, y: mouseY };
    brushOverlayRef.current && (brushOverlayRef.current.style.display = "block");
    applyBrushOverlay();
    
    // Convert to data coordinates
    const xRatio = clamp((mouseX - area.x) / area.width, 0, 1);
    const yRatio = clamp(1 - (mouseY - area.y) / area.height, 0, 1);
    
    const xValue = activeDomain.x[0] + xRatio * (activeDomain.x[1] - activeDomain.x[0]);
    const yValue = activeDomain.y[0] + yRatio * (activeDomain.y[1] - activeDomain.y[0]);
    
    brushStartRef.current = { x: xValue, y: yValue };
    brushEndRef.current = { x: xValue, y: yValue };
    setIsBrushing(true);
  }, [activeDomain, chartMargin, applyBrushOverlay]);

  const handleContainerMouseMoveWithRaf = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBrushing || !chartContainerRef.current || !activeDomain || !chartAreaRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const area = chartAreaRef.current;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xRatio = clamp((mouseX - area.x) / area.width, 0, 1);
    const yRatio = clamp(1 - (mouseY - area.y) / area.height, 0, 1);

    const xValue = activeDomain.x[0] + xRatio * (activeDomain.x[1] - activeDomain.x[0]);
    const yValue = activeDomain.y[0] + yRatio * (activeDomain.y[1] - activeDomain.y[0]);

    pendingBrushUpdateRef.current = {
      pixel: { x: mouseX, y: mouseY },
      data: { x: xValue, y: yValue }
    };

    if (brushMoveFrameRef.current == null) {
      brushMoveFrameRef.current = requestAnimationFrame(() => {
        const pending = pendingBrushUpdateRef.current;
        brushMoveFrameRef.current = null;
        if (!pending) return;
        brushPixelEndRef.current = pending.pixel;
        brushEndRef.current = pending.data;
        applyBrushOverlay();
      });
    }
  }, [isBrushing, activeDomain, applyBrushOverlay]);

  const handleContainerMouseUp = useCallback(() => {
    const start = brushStartRef.current;
    const end = brushEndRef.current;
    if (!isBrushing || !start || !end) {
      setIsBrushing(false);
      brushStartRef.current = null;
      brushEndRef.current = null;
      brushPixelStartRef.current = null;
      brushPixelEndRef.current = null;
      if (brushOverlayRef.current) brushOverlayRef.current.style.display = "none";
      return;
    }

    const xMin = Math.min(start.x, end.x);
    const xMax = Math.max(start.x, end.x);
    const yMin = Math.min(start.y, end.y);
    const yMax = Math.max(start.y, end.y);

    // Require minimum selection range (2% of current view)
    const currentDomain = activeDomain ?? dataBounds;
    const xRange = currentDomain ? currentDomain.x[1] - currentDomain.x[0] : 1;
    const yRange = currentDomain ? currentDomain.y[1] - currentDomain.y[0] : 1;
    
    if ((xMax - xMin) > xRange * 0.02 && (yMax - yMin) > yRange * 0.02) {
      setZoomDomain({ x: [xMin, xMax], y: [yMin, yMax] });
      setZoomSource("brush");
    }

    setIsBrushing(false);
    brushStartRef.current = null;
    brushEndRef.current = null;
    brushPixelStartRef.current = null;
    brushPixelEndRef.current = null;
    if (brushOverlayRef.current) brushOverlayRef.current.style.display = "none";
  }, [isBrushing, activeDomain, dataBounds]);

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setZoomSource(null);
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (brushMoveFrameRef.current != null) {
        cancelAnimationFrame(brushMoveFrameRef.current);
      }
    };
  }, []);

  return {
    isBrushing,
    zoomDomain,
    zoomSource,
    brushOverlayRef,
    chartContainerRef,
    handleContainerMouseDown,
    handleContainerMouseMoveWithRaf,
    handleContainerMouseUp,
    resetZoom,
    setZoomDomain,
    setZoomSource
  };
}
