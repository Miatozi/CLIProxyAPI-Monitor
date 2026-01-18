"use client";

import { startTransition, useEffect, useRef, useState } from "react";

/**
 * Smoothly interpolates Y-axis domain values for chart animations.
 * Uses lerp (linear interpolation) with requestAnimationFrame for smooth transitions.
 */
export function useLerpYDomain(
  targetDomain: [number, number] | undefined,
  factor = 0.15,
  enabled = true
): [number, number] | undefined {
  const [currentDomain, setCurrentDomain] = useState(targetDomain);
  const targetRef = useRef(targetDomain);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // Sync domain when target changes or animation is disabled
  useEffect(() => {
    if (!targetDomain || !enabled) {
      startTransition(() => setCurrentDomain(targetDomain));
    }
  }, [targetDomain, enabled]);

  useEffect(() => {
    targetRef.current = targetDomain;
  }, [targetDomain]);

  useEffect(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Only proceed with animation if target exists and enabled
    if (!targetDomain || !enabled) {
      return;
    }

    // Single path: higher frame rate for smoothness while limiting total duration
    const stepFactor = factor;
    const maxFrames = 60;
    const maxDuration = 1000; // ms
    const snapThreshold = 1; // snap when difference is below this threshold

    startTimeRef.current = null;
    frameRef.current = 0;

    const animate = (timestamp: number) => {
      if (startTimeRef.current == null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      let shouldContinue = true;

      setCurrentDomain(prev => {
        const target = targetRef.current;
        if (!target) {
          shouldContinue = false;
          return undefined;
        }
        if (!prev) {
          shouldContinue = false;
          return target;
        }

        const [currentMin, currentMax] = prev;
        const [targetMin, targetMax] = target;

        const diffMin = targetMin - currentMin;
        const diffMax = targetMax - currentMax;

        const snapMin = Math.abs(diffMin) <= snapThreshold;
        const snapMax = Math.abs(diffMax) <= snapThreshold;

        if (snapMin && snapMax) {
          shouldContinue = false;
          return target;
        }

        return [
          currentMin + diffMin * stepFactor,
          currentMax + diffMax * stepFactor
        ];
      });

      frameRef.current += 1;

      if (!shouldContinue || frameRef.current >= maxFrames || elapsed >= maxDuration) {
        setCurrentDomain(targetRef.current);
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, factor, targetDomain]);

  return currentDomain;
}
